const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();


app.use(express.json())
app.use(cors())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sv8l1qb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const classCollection = client.db("languageCamp").collection("classes");
        const usersCollection = client.db("languageCamp").collection("users");
        const cartCollection = client.db("languageCamp").collection("cart");

        //classes
        app.get('/classes', async (req, res) => {
            const { email } = req.query;
            if (!email) {

                const result = await classCollection.find().toArray();
                return res.send(result)
            }
            const result = await classCollection.find({ email }).toArray()
            res.send(result)
        })


        app.post('/classes', async (req, res) => {
            const data = req.body;
            const result = await classCollection.insertOne(data);
            res.send(result)
        })

        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const { status, comment } = req.body;

            if (status === 'approve') {
                const updateDoc = {
                    $set: {
                        status: 'approve',
                        comment: comment || ''
                    }
                }
                const result = await classCollection.updateOne(filter, updateDoc);
                return res.send(result);
            } else if (status === 'denied') {
                const updateDoc = {
                    $set: {
                        status: 'denied',
                        comment: comment || '',
                    }
                }
                const result = await classCollection.updateOne(filter, updateDoc);
                return res.send(result);
            }

        });

        //users 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            } else {
                const result = await usersCollection.insertOne(user)
                res.send(result)
            }
        })

        app.get('/users/userRole/:email', async(req, res)=>{
            const email = req.params.email;

            const query = {email: email}
            const user = await usersCollection.findOne(query);
            const result = {userRole: user?.role}
            res.send(result)
          })

        app.get('/users', async (req, res) => {
            const { role } = req.query;
            console.log(role);
            if (role) {
                const result = await usersCollection.find({ role }).toArray();
                return res.send(result);
            }
            const result = await usersCollection.find().toArray()
            res.send(result)
        })
        // app.get('/users', async (req, res) => {
        //     const { role, email } = req.query;
        //     if (!role && !email) {
        //       const result = await usersCollection.find().toArray();
        //       return res.send(result);
        //     }
        //     const query = {};
        //     if (role) {
        //       query.role = role;
        //     }
        //     if (email) {
        //       query.email = email;
        //     }
        //     const result = await usersCollection.find(query).toArray();
        //     res.send(result);
        //   });

        // make admin or instructor 
        app.patch('/users/:id/role', async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;
            console.log(id, role);
            const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
            res.send(result);

        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        //cart 
        app.post('/cart', async (req, res) => {
            const cartData = req.body;

            const query = { courseId: cartData.courseId, email: cartData.email }
            const existingCourse = await cartCollection.findOne(query)
            if (existingCourse) {
                return res.send({ message: 'already added' })
            }
            const result = await cartCollection.insertOne(cartData);
            res.send(result);
        })

        app.get('/cart', async (req, res) => {
            const email = req.query.email;

            const result = await cartCollection.find({ email: email }).toArray();
            res.send(result)
        })

        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })
// create payment intent

app.post("/create-payment-intent", async (req, res) => {
    const { price } = req.body;
    const amount = price * 100;
  
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ['card'],
    });
  
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('language-quest-camp-server-running')
})

app.listen(port, () => {
    console.log(`language quest camp server is running on port ${port}`);
})