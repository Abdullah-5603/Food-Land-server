const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
require('dotenv').config()
const cors = require('cors');
const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())



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
    await client.connect();
    // Send a ping to confirm a successful connection

    const menuCollection = client.db('FoodLand').collection('menu')
    const reviewsCollection = client.db('FoodLand').collection('revewies')

    app.get('/menu', async (req, res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result)
    })
    app.get('/reviews', async (req, res)=>{
        const result = await reviewsCollection.find().toArray();
        res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err){
    console.log(err.message)
  }
}
run().catch(console.dir);



app.get('/', (req, res) =>{
    res.send('Food Land Here')
})

app.listen(port, (req, res) =>{

})