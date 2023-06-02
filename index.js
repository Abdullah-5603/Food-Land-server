const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const EventEmitter = require('events');
const bus = new EventEmitter();
const stripe = require('stripe')
require('dotenv').config()
const cors = require('cors');
const { default: Stripe } = require('stripe');
const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.static("public"))
app.use(express.json())
bus.setMaxListeners(15)


const verifyJWT = (req, res, next) =>{
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({error : true, message : 'Unauthorize Access' })
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded)=>{
    if(error){
      console.log(error)
      return res.send({error : true, message : 'Unauthorize Access' })
    }
    req.decoded = decoded;
    next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jjaqgwq.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();
    // Send a ping to confirm a successful connection

    const menuCollection = client.db('FoodLand').collection('menu')
    const reviewsCollection = client.db('FoodLand').collection('revewies')
    const cartsCollection = client.db('FoodLand').collection('carts')
    const usersCollection = client.db('FoodLand').collection('users')
    const paymentCollection = client.db('FoodLand').collection('payment')

    app.post('/jwt', (req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn : '10h'})
      res.send({token})
    })

    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email;
      const query = {email : email}
      const user = await usersCollection.findOne(query)
      if(user?.role !== 'admin'){
        return res.status(403).send({error : true, message : 'Forbidden Access' })
      }
      next()
    }

    //users related apis
    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email : user.email }
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send({})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    app.get('/users',verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    app.get('/user/admin/:email',verifyJWT, async(req, res)=>{
      const email = req.params.email

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error : true, message : 'False User' })
      }

      const query = {email : email}
      const user = await usersCollection.findOne(query)
      const result = {admin : user?.role === 'admin'}
      res.send(result)
    })

    app.patch('/users/admin/:id',verifyJWT, async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const updatedDoc = {
        $set : {
          role : 'admin'
        }
      }
      const result  = await usersCollection.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.delete('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    // menu collection

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })

    app.post('/menu', async(req, res)=>{
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    })

    app.delete('/menu/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })

    // cart collection

    app.post('/carts', async (req, res) => {
      try {
        const item = req.body;
        const result = await cartsCollection.insertOne(item)
        res.send(result)
      } catch (error) {
        res.send(error.message)
      }
    })
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([])
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error : true, message : 'Forbidden Access' })
      }

      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result)
    })
    app.delete('/carts', async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await cartsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send('Internal Server Error');
      }
    });

    //create payment intent
    // app.post('/create-payment-intent', verifyJWT, async (req, res) => {
    //   const price = req.body;
    //   console.log(price);
    //   const amount = price * 100;
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: 'usd',
    //     payment_method_types: ['card']
    //   });
    //   res.send({
    //     clientSecret: paymentIntent.client_secret
    //   });
    // });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const stripeClient = stripe(process.env.STRIPE_KEY);
      try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount: amount,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });
    
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: "An error occurred while creating the PaymentIntent." });
      }
    });

    //payment related api

    app.post('/payment', async(req, res)=>{
      const payment = req.body;
      const insertResult  =await paymentCollection.insertOne(payment)

      const query = { _id : {$in : payment.cartItems.map(id => new ObjectId(id))}}
      const deleteResult = await cartsCollection.deleteMany(query)
      res.send({insertResult, deleteResult})
    })
    
    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!")
  } catch (err) {
    console.log(err.message)
  }
}
run().catch(console.dir)



app.get('/', (req, res) => {
  res.send('Food Land Here')
})

app.listen(port, (req, res) => {

})