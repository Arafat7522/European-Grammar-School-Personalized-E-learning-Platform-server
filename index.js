require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URL;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@madamtrails.6ckcarh.mongodb.net/?retryWrites=true&w=majority`;

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    console.log("mongodb connected successfully");

    // collections
    const UsersCollection = client.db("rating-profile").collection("users");
    const ReviewCollection = client.db("rating-profile").collection("reviews");
    // test
    app.get("/", async (req, res) => {
      res.send({ success: true });
    });

    // posting users
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const filter = { email: newUser.email };
      const exist = await UsersCollection.findOne(filter);
      if (exist) {
        return res.send({ success: false, message: "User already exists" });
      }
      newUser.createdAt = new Date();
      const result = await UsersCollection.insertOne(newUser);
      res.send({ success: true, message: "Successfully done", data: result });
    });

    // getting all users along with average rating
    app.get("/users", async (req, res) => {
      const { searchTerm, page } = req?.query ?? {};
      const pageNumber = parseInt(page) || 1;
      const itemsPerPage = 20;
      const skipCount = (pageNumber - 1) * itemsPerPage;

      const query = searchTerm
        ? {
            $or: [
              { firstName: { $regex: new RegExp(searchTerm, "i") } },
              { lastName: { $regex: new RegExp(searchTerm, "i") } },
            ],
          }
        : {};

      // Aggregation pipeline to calculate average rating
      const pipeline = [
        // Match users based on the query
        { $match: query },
        // Lookup reviews for each user
        {
          $lookup: {
            from: "reviews",
            localField: "_id",
            foreignField: "receiverId",
            as: "reviews",
          },
        },
        // Project fields to include in the result
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            bio: 1,
            email: 1,
            createdAt: 1,
            photo: 1,
            totalRating: 1,
            reviewer: 1,
            // Calculate average rating from reviews
            averageRating: { $ifNull: [{ $avg: "$reviews.rating" }, 0] },
          },
        },
        // Skip and limit for pagination
        { $skip: skipCount },
        { $limit: itemsPerPage },
      ];
      const countQuery = await UsersCollection.find({}).toArray();
      const result = await UsersCollection.aggregate(pipeline)
        .sort({ createdAt: -1 })
        .toArray();
      res.send({
        success: true,
        total: countQuery?.length || 0,
        page: page || 1,
        limit: itemsPerPage,
        data: result,
      });
    });

    // getting single user with email
    app.get("/users/single/:email", async (req, res) => {
      const email = req?.params?.email;
      const filter = { email };
      const reviews = await ReviewCollection.aggregate([
        { $match: { receiverEmail: email } },
        {
          $group: {
            _id: null, // Group all reviews together
            averageRating: { $avg: "$rating" }, // Calculate the average rating
            totalReviews: { $sum: 1 },
          },
        },
      ]).toArray();
      const result = await UsersCollection.findOne(filter);
      if (result) {
        result.averageRating = reviews?.length
          ? reviews[0]?.averageRating || 0
          : 0;
        result.totalReviews = reviews?.length
          ? reviews[0]?.totalReviews || 0
          : 0;
      }
      res.send({ success: true, message: "Successfully done", data: result });
    });

    // updating users
    app.put("/users", async (req, res) => {
      const email = req?.query?.email;
      const payload = req?.body;
      const filter = { email };
      const updatedFields = {};

      // Iterate over the payload and add fields to the updatedFields object
      for (const key in payload) {
        // Only add fields that are not undefined
        if (payload[key] !== undefined) {
          updatedFields[key] = payload[key];
        }
      }

      const updatedDocument = { $set: updatedFields };

      const options = { upsert: true };
      const result = await UsersCollection.updateOne(
        filter,
        updatedDocument,
        options
      );
      res.send({ success: true, message: "Successfully done", data: result });
    });

    // uploading/updating image of user

    // posting new feedback
    app.post("/reviews", async (req, res) => {
      const payload = req?.body;

      payload.createdAt = new Date();
      const result = await ReviewCollection.insertOne(payload);
      if (result) {
        const filter = { email: payload?.receiverEmail };
        const updatedDocument = {
          $inc: {
            totalRating: parseInt(payload?.rating),
            reviewer: 1,
          },
        };
        const options = { upersert: true };

        await UsersCollection.updateOne(filter, updatedDocument, options);
      }
      res.send({ success: true, message: "Successfully done", data: result });
    });

    // getting feedback for a single user with email
    app.get("/reviews/:email", async (req, res) => {
      const email = req?.params?.email;
      const filter = { receiverEmail: email };
      const result = await ReviewCollection.find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      res.send({ success: true, message: "Success!", data: result });
    });

    // send email
    app.post("/send-mail", async (req, res) => {
      const { name, email, message } = req?.body ?? {};
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "safwanridwan321@gmail.com",
          pass: process.env.AUTH_PASS,
        },
      });

      const mailOptions = {
        from: email,
        to: "safwanridwan321@gmail.com",
        subject: `Message from Rating Profile`,
        html: `
        <p>Name: <strong>${name}</strong>.</p>
        <p>${message}</p>
      `,
      };

      const result = await await transporter.sendMail(mailOptions);
      res.send({ success: true, message: "Message Sent", data: result });
    });

    // getting top rated prfile
    app.get("/users/top-rated", async (req, res) => {
      const result = await UsersCollection.aggregate([
        // Calculate the average rating
        {
          $addFields: {
            averageRating: { $divide: ["$totalRating", "$reviewer"] },
          },
        },
        // Sort users by average rating in descending order
        { $sort: { averageRating: -1 } },
        // Limit to 5 users
        { $limit: 7 },
      ]).toArray();
      res.send({ success: true, data: result });
    });
    // getting suggested profile
    app.get("/users/suggested", async (req, res) => {
      const result = await UsersCollection.aggregate([
        // Calculate the average rating
        {
          $addFields: {
            averageRating: { $divide: ["$totalRating", "$reviewer"] },
          },
        },
        // Sort users by average rating in descending order
        { $sort: { createdAt: -1 } },
        // Limit to 5 users
        { $limit: 7 },
      ]).toArray();
      res.send({ success: true, data: result });
    });
    // posting a review
  } catch (err) {
    console.log(err);
    res.send;
  }
}
run();

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
