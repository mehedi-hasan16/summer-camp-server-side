const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
var jwt = require('jsonwebtoken');

//middleware 
app.use(cors())
app.use(express.json())


//jwt verify
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

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
        const paymentCollection = client.db("languageCamp").collection("payments");
        const reviewCollection = client.db("languageCamp").collection("review");

        //jwt post 

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })

            res.send({ token })
        })

        // jwt admin verifiy
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }
        // jwt instrructor verifiy 
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }





        //payment classes 
        app.get('/enrolledClasses/:email', async (req, res) => {
            const { email } = req.params;
            const result = await paymentCollection.find({ email }).sort({ date: -1 }).toArray();
            res.send(result)
        })



        //get 6 class based on top number of students
        app.get('/classes/topSort', async (req, res) => {
            const result = await classCollection.find().sort({ enrolled: -1 }).limit(6).toArray();
            res.send(result);
        });

        //classes

        //approve classes 

        app.get('/classes/approve', async (req, res) => {
            const result = await classCollection.find({ status: 'approve' }).toArray();
            return res.send(result)
        })

        app.get('/classes', async (req, res) => {
            const { email } = req.query;
            if (!email) {

                const result = await classCollection.find().toArray();
                return res.send(result)
            }
            const result = await classCollection.find({ email }).toArray()
            res.send(result)
        })

        //class post
        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const data = req.body;
            const result = await classCollection.insertOne(data);
            res.send(result)
        })

        //class patch

        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const { status, comment } = req.body;

            if (status === 'approve') {
                const updateDoc = {
                    $set: {
                        status: 'approve',
                        comment: comment || '',
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



        // total sells and total seats of the course 
        app.post('/courses/:id/purchase', async (req, res) => {
            const courseId = req.params.id;

            console.log(courseId);
            // Find the course by its ID
            const course = await classCollection.findOne({ _id: new ObjectId(courseId) });

            console.log(course);

            // Check if there are available seats
            if (course.seats <= 0) {
                return res.send({ message: 'No available seats' });
            }

            // Decrement the number of seats and increment enrolled
            const updatedCourse = await classCollection.findOneAndUpdate({ _id: new ObjectId(courseId) },
                { $inc: { seats: -1, enrolled: 1 } },
                { returnOriginal: false }
            );

            res.send(updatedCourse);
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

        app.get('/users/userRole/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { userRole: user?.role }
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

        app.get('/users/limitInstructor', async (req, res) => {
            const result = await usersCollection.find({ role: 'instructor' }).limit(6).toArray();
            res.send(result);
        });

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

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: new ObjectId(payment.item._id) };
            const deleteResult = await cartCollection.deleteOne(query);

            res.send({ insertResult, deleteResult });
        })

        //review 
        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


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