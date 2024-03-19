const express = require('express');
const hbs = require('hbs');
const wax = require('wax-on');
const { createConnection } = require('mysql2/promise');
require('dotenv').config();

const app = express();

app.set('view engine', 'hbs');

require('handlebars-helpers')({
    handlebars: hbs.handlebars
})

app.use(express.static('public'));

app.use(express.urlencoded({
    extended: false
}))

wax.on(hbs.handlebars);
wax.setLayoutPath('./views/layouts');

async function main(){
    const connection = await createConnection({
        'host':process.env.DB_HOST,
        'user': process.env.DB_USER,
        'database': process.env.DB_DATABASE,
        'password': process.env.DB_PASSWORD
    })


    // READ
    app.get('/customers', async (req, res) => {
        const query = `SELECT C.*, C1.name AS company_name FROM Customers C LEFT JOIN Companies C1 ON C.company_id = C1.company_id ORDER BY C.first_name`;
        const [customers] = await connection.execute(query);

        res.render('customers', {
            customers
        })
    })

    // CREATE
    app.get('/create-customers', async (req, res) => {
        const query = `SELECT * FROM Companies`
        const [companies] = await connection.execute(query);

        res.render('create-customers', {
            companies
        })
    })

    app.post('/create-customers', async (req, res) => {
        const {first_name, last_name, rating, company_id} = req.body;
        const query = `INSERT INTO Customers (first_name, last_name, rating, company_id)
                        VALUES ("${first_name}", "${last_name}", ${rating}, ${company_id})`;

        const response = await connection.execute(query);
        res.redirect('/customers');
    })

    // UPDATE
    app.get('/update-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;

        const query = `SELECT * FROM Customers WHERE customer_id = ${customerId}`
        const [customers] = await connection.execute(query);
        const [companies] = await connection.execute(`SELECT * FROM Companies`);
    
        const customerToUpdate = customers[0];
        res.render('update-customers', {
            customer: customerToUpdate,
            companies: companies
        })
    })

    app.post('/update-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;
        const {first_name, last_name, rating, company_id} = req.body;
        const query = `UPDATE Customers SET first_name="${first_name}",
                        last_name="${last_name}", 
                        rating=${rating},
                        company_id=${company_id}
                       WHERE customer_id = ${customerId};`
    
        await connection.execute(query);
        res.redirect('/customers');
    })


    // DELETE
    app.get('/delete-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;
        const [customers] = await connection.execute(`SELECT * FROM Customers WHERE customer_id = ${customerId}`);
        const customerToDelete = customers[0];

        res.render('delete-customers', {
            customer: customerToDelete
        })
    })

    app.post('/delete-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;

        // check if the customerId in a relationship with an employee
        const checkCustomerQuery = `SELECT * FROM EmployeeCustomer WHERE customer_id = ${customerId}`;
        const [involved] = await connection.execute(checkCustomerQuery);
        if (involved.length > 0) {
            res.send("Unable to delete because the customer is in a sales relationship of an employee");
            return;
        }
    
        const query = `DELETE FROM Customers C WHERE C.customer_id = ${customerId}`;
        await connection.execute(query);
        res.redirect('/customers')
    })
    
}

app.listen(8000, () => {
    console.log("server has started")
})

main();