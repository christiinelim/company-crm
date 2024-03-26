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
    // app.get('/customers', async (req, res) => {
    //     const query = `SELECT C.*, C1.name AS company_name FROM Customers C LEFT JOIN Companies C1 ON C.company_id = C1.company_id ORDER BY C.first_name`;
    //     const [customers] = await connection.execute(query);

    //     res.render('customers', {
    //         customers
    //     })
    // })

    app.get('/customers', async (req, res) => {
        // example: /customers?firstName=Alice&?lastName=Johnson
        const { firstName, lastName, companyName } = req.query;
    
        let query = `SELECT C.*, C1.name AS company_name FROM Customers C LEFT JOIN Companies C1 ON C.company_id = C1.company_id`;
    
        const whereClauses = [];
    
        if (firstName) {
            whereClauses.push(`C.first_name = '${firstName}'`);
        }
        if (lastName) {
            whereClauses.push(`C.last_name = '${lastName}'`);
        }
        if (companyName) {
            whereClauses.push(`C1.name = '${companyName}'`);
        }
    
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
    
        query += ` ORDER BY C.first_name`;
    
        try {
            const [customers] = await connection.execute(query);
            res.render('customers', { customers });
        } catch (error) {
            console.error('Error fetching customers:', error);
            res.status(500).send('Error fetching customers');
        }
    });
    

    // CREATE
    app.get('/create-customers', async (req, res) => {
        const query = `SELECT * FROM Companies`
        const [companies] = await connection.execute(query);
        const [employees] = await connection.execute(`SELECT * FROM Employees`);

        res.render('create-customers', {
            companies, 
            employees
        })
    })

    app.post('/create-customers', async (req, res) => {
        const {first_name, last_name, rating, company_id} = req.body;
        const query = `INSERT INTO Customers (first_name, last_name, rating, company_id)
                            VALUES (?,?,?,?);`

        const [response] = await connection.execute(query, [first_name, last_name, rating, company_id]);

        // ID of newly inserted row
        const insertId = response.insertId;

        const {employees} = req.body;
        
        let employeeArray = [];

        if (Array.isArray(employees)) {
            employeeArray = employees;
        } else {
            employeeArray.push(employees)
        }

        for (let employee_id of employeeArray){
            const employee_query = `INSERT INTO EmployeeCustomer (employee_id, customer_id) 
            VALUES (?, ?)`

            await connection.execute(employee_query, [employee_id, insertId]);
        }

        res.redirect('/customers');
    })

    // UPDATE
    app.get('/update-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;

        const query = `SELECT * FROM Customers WHERE customer_id = ?`
        const [customers] = await connection.execute(query, [customerId]);
        const [companies] = await connection.execute(`SELECT * FROM Companies`);
        const [employees] = await connection.execute(`SELECT * FROM Employees`);

        // Retrieve all the employees currently serving the customer
        const [currentEmployees] = await connection.execute(`SELECT * FROM EmployeeCustomer WHERE customer_id = ?`, [customerId]);
    
        const employeeIds = currentEmployees.map((e) => {
            return e.employee_id;
        })

        const customerToUpdate = customers[0];
        res.render('update-customers', {
            customer: customerToUpdate,
            companies,
            employees,
            employeeIds
        })
    })

    app.post('/update-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;
        const {first_name, last_name, rating, company_id} = req.body;
        const query = `UPDATE Customers SET first_name = ?,
                        last_name = ?, 
                        rating = ?,
                        company_id = ?
                        WHERE customer_id = ?;`

        await connection.execute(query, [first_name, last_name, rating, company_id, customerId]);

        // Update relationship after updating Customers table
        // Delete relationship
        await connection.execute(`DELETE FROM EmployeeCustomer WHERE customer_id = ?;`, [customerId]);

        // Re add new relationship
        const {employees} = req.body;
        
        let employeeArray = [];

        if (Array.isArray(employees)) {
            employeeArray = employees;
        } else {
            employeeArray.push(employees)
        }

        for (let employee_id of employeeArray){
            await connection.execute(`INSERT INTO EmployeeCustomer (employee_id, customer_id) 
                                        VALUES (?, ?)`, [employee_id, customerId])
        }

        res.redirect('/customers');
    })


    // DELETE
    app.get('/delete-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;
        const [customers] = await connection.execute(`SELECT * FROM Customers WHERE customer_id = ?;`, [customerId]);
        const customerToDelete = customers[0];

        res.render('delete-customers', {
            customer: customerToDelete
        })
    })

    app.post('/delete-customers/:customerId', async (req, res) => {
        const {customerId} = req.params;

        // Check if the customerId in a relationship with an employee
        const checkCustomerQuery = `SELECT * FROM EmployeeCustomer WHERE customer_id = ?;`
        const [involved] = await connection.execute(checkCustomerQuery, [customerId]);
        if (involved.length > 0) {
            res.send("Unable to delete because the customer is in a sales relationship of an employee");
            return;
        }
    
        const query = `DELETE FROM Customers C WHERE C.customer_id = ?;`
        await connection.execute(query, [customerId]);
        res.redirect('/customers')
    })
    
}

app.listen(8000, () => {
    console.log("server has started")
})

main();