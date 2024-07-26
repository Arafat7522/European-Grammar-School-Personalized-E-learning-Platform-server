require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URL;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@madamtrails.6ckcarh.mongodb.net/?retryWrites=true&w=majority`;

const multer = require("multer");
const cloudinary = require("cloudinary");
const storage = multer.diskStorage({});

const upload = multer({ storage });
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
    const UsersCollection = client.db("EGSPEP").collection("users");
    const ClassesCollection = client.db("EGSPEP").collection("classes");
    const SubjectsCollection = client.db("EGSPEP").collection("subjects");
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

    // getting single user with email
    app.get("/users/single/:email", async (req, res) => {
      const email = req?.params?.email;
      const filter = { email };

      const result = await UsersCollection.findOne(filter);

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
        <p>Name: <strong>${name} - ${email}</strong>.</p>
        <p>${message}</p>
      `,
      };

      const result = await transporter.sendMail(mailOptions);
      res.send({ success: true, message: "Message Sent", data: result });
    });

    // Inviting to the subject
    app.post("/invite", async (req, res) => {
      const { classId, subjectId, classTitle, subjectTitle, email, role } =
        req?.body;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "safwanridwan321@gmail.com",
          pass: process.env.AUTH_PASS,
        },
      });

      const mailOptions = {
        from: "safwanridwan321@gmail.com",
        to: email,
        subject: `Invitation received`,
        html: `
        <p>Class: <strong>${classTitle}</strong>.</p>
        <p>Subject: <strong>${subjectTitle}</strong>.</p>
        <a href="http://localhost:5173/accept-invitation/${classId}/${subjectId}/${email}/${role}">Accept</a>
      `,
      };

      const result = await transporter.sendMail(mailOptions);
      res.send({ success: true, message: "Message Sent", data: result });
    });

    // accepting invitation
    app.post("/accept-invitation", async (req, res) => {
      const {classId} = req?.body;

    });

    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    // updating or posting an image on profile
    app.post("/users/upload", upload.single("image"), async (req, res) => {
      const email = req?.query?.email;
      const file = req?.file;

      if (!file) {
        return res.send({ success: false, message: "Something went wrong" });
      }

      const result = await cloudinary.v2.uploader.upload(file.path);
      const user = await UsersCollection.findOneAndUpdate(
        { email },
        { $set: { photo: result?.secure_url } },
        { upsert: true, new: true }
      );

      res.send({ success: true, message: "Successfully Uploaded", data: user });
    });

    // class related routes and controllers
    app.post("/class/create", async (req, res) => {
      const newClass = req?.body;
      const result = await ClassesCollection.insertOne(newClass);
      res.send({
        success: true,
        message: "Created Successfully",
        data: result,
      });
    });

    // getting all the classes
    app.get("/class/all", async (req, res) => {
      const result = await ClassesCollection.find({}).toArray();
      res.send({
        success: true,
        message: "Found Successfully",
        data: result,
      });
    });

    // getting single class
    app.get("/class/single/:classId", async (req, res) => {
      const classId = req?.params?.classId;
      const result = await ClassesCollection.findOne({
        _id: new ObjectId(classId),
      });

      res.send({ success: true, message: "Found Successfully", data: result });
    });

    // Subject related routes and controllers
    app.post("/subject/create", async (req, res) => {
      const classId = req?.body?.classId;
      const newSubject = req?.body;

      const classExist = await ClassesCollection.findOne({
        _id: new ObjectId(classId),
      });
      if (!classExist) {
        return res.send({
          success: false,
          message: "Class does not exist",
          data: null,
        });
      }

      const result = await SubjectsCollection.insertOne(newSubject);
      res.send({
        success: true,
        message: "Created Successfully",
        data: result,
      });
    });

    // all subjects for single class
    app.get("/class/:classId/subjects", async (req, res) => {
      const classId = req?.params?.classId;
      const result = await SubjectsCollection.find({ classId }).toArray();
      res.send({
        success: true,
        message: "Subjects found",
        data: result,
      });
    });
    // getting single subject
    app.get("/subject/single/:subjectId", async (req, res) => {
      const subjectId = req?.params?.subjectId;
      const result = await SubjectsCollection.findOne({
        _id: new ObjectId(subjectId),
      });

      res.send({
        success: true,
        message: "Subject found",
        data: result,
      });
    });
  } catch (err) {
    console.log(err);
  }
}
run();

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
