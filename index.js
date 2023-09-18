const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    client.connect();

    const serviceCollection = client.db("jerinsParlour").collection("services");
    const bookingCollection = client.db("jerinsParlour").collection("bookings");
    const reviewCollection = client.db("jerinsParlour").collection("reviews");
    const userCollection = client.db("jerinsParlour").collection("users");

    // jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    });

    // verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "Admin") {
        return res.status(403).send({ error: true, message: "forbidden" });
      }
      next();
    };

    // users api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists." });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { role: user?.role };
      res.send(result);
    });

    // updating user role
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const role = req.query.role;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.delete(
      "/users/admin/:name",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const name = req.params.name;
        const query = { name: name };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      }
    );

    // services api
    app.get("/services", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const result = await serviceCollection.find().limit(limit).toArray();
      res.send(result);
    });

    app.get("/services/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    app.post("/services", verifyJWT, async (req, res) => {
      const newService = req.body;
      const result = await serviceCollection.insertOne(newService);
      res.send(result);
    });

    app.patch("/services/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const updatedDoc = {
        $set: {
          title: data.title,
          price: parseFloat(data.price),
          description: data.description,
        },
      };
      const filter = { _id: new ObjectId(id) };
      const result = await serviceCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // bookings api
    app.post("/bookings", async (req, res) => {
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
