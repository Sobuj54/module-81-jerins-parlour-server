const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// jwt verification
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      res.status(403).send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.l0lz8w0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("jerinsParlour").collection("services");
    const bookingCollection = client.db("jerinsParlour").collection("bookings");
    const reviewCollection = client.db("jerinsParlour").collection("reviews");

    // jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    });

    // services api
    app.get("/services", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const result = await serviceCollection.find().limit(limit).toArray();
      res.send(result);
    });

    // bookings api
    app.post("/bookings", verifyJWT, async (req, res) => {
      const bookingInfo = req.body;
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    // get bookings
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (email) {
        const query = { email: email };
        const result = await bookingCollection.find(query).toArray();
        return res.send(result);
      }

      const options = {
        sort: {
          userName: 1,
        },
        projection: {
          _id: 1,
          userName: 1,
          email: 1,
          title: 1,
          isPaid: 1,
        },
      };
      // be careful when using only options in find..find function takes two parameters one is query and other is options so when using only options ..we should provide empty object to first argument.
      const allBookings = await bookingCollection.find({}, options).toArray();
      res.send(allBookings);
    });

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/reviews", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log("server is running at port :", port);
});
