require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URL;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@madamtrails.6ckcarh.mongodb.net/?retryWrites=true&w=majority`;

const multer = require("multer");
// const storage = multer.diskStorage({});
// const upload = multer({ storage });
const upload = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 500000 },
});

const cloudinary = require("cloudinary");
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
    const MembershipCollection = client.db("EGSPEP").collection("memberships");
    const MaterialCollection = client.db("EGSPEP").collection("materials");
    const ClassWorkCollection = client.db("EGSPEP").collection("classworks");
    const ClassWorkSubmissionCollection = client
      .db("EGSPEP")
      .collection("classworksubmissions");
    const AttendenceCollection = client.db("EGSPEP").collection("attedence");

    // test
    app.get("/", async (req, res) => {
      res.send({ success: true });
    });

    // posting users
    app.post("/users", async (req, res) => {
      const newUser = req?.body;
      const filter = { email: newUser.email };
      const exist = await UsersCollection.findOne(filter);
      if (exist) {
        return res.send({ success: false, message: "User already exists" });
      }

      newUser.createdAt = new Date();
      if (!newUser?.role) {
        newUser.role = "user";
      }
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

    // memberships
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
        <p>You have been invitated to join the following subject of the class.</p>
        <p>Class: <strong>${classTitle}</strong>.</p>
        <p>Subject: <strong>${subjectTitle}</strong>.</p>
        <a href="http://localhost:5173/accept-invitation/${classId}/${subjectId}/${email}/${role}">Accept Invitation</a>
      `,
      };

      const result = await transporter.sendMail(mailOptions);
      res.send({ success: true, message: "Message Sent", data: result });
    });

    // accepting invitation
    app.post("/accept-invitation", async (req, res) => {
      const { classId, subjectId, classTitle, subjectTitle, role, email } =
        req?.body;

      const subject = await SubjectsCollection.findOne({
        _id: new ObjectId(subjectId),
      });
      await (req.body.description = subject?.description);

      if (
        !(classId && subjectId && classTitle && subjectTitle && role && email)
      ) {
        return res.send({
          success: false,
          message: "Something went wrong! Ask for another invitation.",
        });
      }
      const result = await MembershipCollection.insertOne(req?.body);
      res.send({
        success: true,
        message: "Invitation accepted",
        data: result,
      });
    });

    // getting role specific class list
    app.get("/class/my-class/:email", async (req, res) => {
      const email = req?.params?.email;
      const pResult = await MembershipCollection.find({ email }).toArray();
      let result = [];
      await pResult.forEach((r) => {
        if (!result?.length) {
          result.push(r);
        } else {
          result.forEach((newR) => {
            if (r?.classId != newR?.classId) {
              result.push(r);
            }
          });
        }
      });
      res.send({
        success: true,
        message: "Classes found",
        data: result,
      });
    });

    // getting role specific subject list
    app.get("/class/:classId/my-subject/:email", async (req, res) => {
      const email = req?.params?.email;
      const classId = req?.params?.classId;
      const result = await MembershipCollection.find({
        email,
        classId,
      }).toArray();
      res.send({
        success: true,
        message: "Classes found",
        data: result,
      });
    });

    // Class Materials
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // uploading file to cloudinary
    app.post("/upload-file", upload.single("file"), async (req, res) => {
      const file = req?.file;
      console.log(file);

      if (!file) {
        return res.send({ success: false, message: "Something went wrong" });
      }

      const result = await cloudinary.v2.uploader.upload(file.path);
      res.send({
        success: true,
        message: "Successfully Uploaded",
        data: result,
      });
    });

    // updating or posting an material
    app.post("/material/create", async (req, res) => {
      const {
        classId,
        classTitle,
        subjectId,
        subjectTitle,
        materialText,
        materialFile,
        teacherEmail,
      } = req?.body;
      req.body.date = new Date();

      const result = await MaterialCollection.insertOne(req?.body);
      res.send({
        success: true,
        message: "Successfully created",
        data: result,
      });
    });

    // getting list of class materials for specific class and subject
    app.get("/subject/:subjectId/material/all", async (req, res) => {
      const subjectId = req?.params?.subjectId;
      const result = await MaterialCollection.find({ subjectId })
        .sort({ date: -1 })
        .toArray();

      res.send({
        success: true,
        message: "Successfully found",
        data: result,
      });
    });

    // Class works section
    // Creatintg new class work
    app.post("/class-work/create", async (req, res) => {
      const {
        classId,
        classTitle,
        subjectId,
        subjectTitle,
        instructionText,
        instructionFile,
        teacherEmail,
        submissionDate,
      } = req?.body;
      req.body.date = new Date();

      const result = await ClassWorkCollection.insertOne(req?.body);
      res.send({
        success: true,
        message: "Successfully created",
        data: result,
      });
    });

    // getting list of class work
    app.get("/subject/:subjectId/class-work/all", async (req, res) => {
      const subjectId = req?.params?.subjectId;
      const result = await ClassWorkCollection.find({ subjectId })
        .sort({ date: -1 })
        .toArray();

      res.send({
        success: true,
        message: "Successfully found",
        data: result,
      });
    });

    // getting single class work
    app.get("/class-work/single/:classWorkId", async (req, res) => {
      const classWorkId = req?.params?.classWorkId;
      const result = await ClassWorkCollection.findOne({
        _id: new ObjectId(classWorkId),
      });

      res.send({
        success: true,
        message: "Successfully found",
        data: result,
      });
    });

    // class work submission
    app.post("/class-work/submission/create", async (req, res) => {
      const {
        classWorkId,
        classId,
        classTitle,
        subjectId,
        subjectTitle,
        instructionText,
        instructionFile,
        teacherEmail,
        studentEmail,
        studentName,
        studentId,
        submissionDate,
        submissionText,
        submissionFile,
      } = req?.body;
      req.body.date = new Date();

      const result = await ClassWorkSubmissionCollection.insertOne(req?.body);
      res.send({
        success: true,
        message: "Successfully submitted",
        data: result,
      });
    });

    // getting single submission for student
    app.get("/class-work/:classWorkId/submission/:email", async (req, res) => {
      const classWorkId = req?.params?.classWorkId;
      const email = req?.params?.email;

      const result = await ClassWorkSubmissionCollection.findOne({
        classWorkId,
        studentEmail: email,
      });

      if (!result) {
        return res.send({
          success: false,
          message: "Not found",
        });
      }

      res.send({
        success: true,
        message: "Successfully found",
        data: result,
      });
    });

    // getting list of submission for specific class work
    app.get("/class-work/:classWorkId/submissions/all", async (req, res) => {
      const classWorkId = req?.params?.classWorkId;

      const result = await ClassWorkSubmissionCollection.find({
        classWorkId,
      })
        .sort({ date: -1 })
        .toArray();

      res.send({
        success: true,
        message: "Successfully found",
        data: result,
      });
    });

    // Marking class work
    app.put("/submission/:submissionId/mark", async (req, res) => {
      const submissionId = req?.params?.submissionId;
      const mark = Number(req?.query?.totalMark);

      const result = await ClassWorkSubmissionCollection.findOneAndUpdate(
        {
          _id: new ObjectId(submissionId),
        },
        {
          $set: {
            mark: mark,
          },
        },
        {
          upsert: true,
        }
      );

      res.send({
        success: true,
        message: "Successfully marked",
        data: result,
      });
    });

    // attendence
    // getting list of student for specific class>subject (invited)
    app.get("/subject/:subjectId/student", async (req, res) => {
      const subjectId = req?.params?.subjectId;
      const members = await MembershipCollection.find({
        subjectId,
        role: "student",
      }).toArray();

      const emails = await members.map((member) => member?.email);

      const result = await UsersCollection.find({
        email: { $in: emails },
      }).toArray();

      res.send({
        success: true,
        message: "Successfully found!",
        data: result,
      });
    });
    // recording attendence
    app.post("/attendence/create", async (req, res) => {
      const {
        classId,
        classTitle,
        subjectId,
        subjectTitle,
        date,
        teacherEmail,
      } = req?.body;

      if (!date) {
        let d = new Date();
        req.body.date =
          d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
      }

      const alreadyExist = await AttendenceCollection.findOne({
        date: req?.body?.date,
      });
      if (alreadyExist) {
        return res.send({
          success: false,
          message: "Attendence recorded once!",
          data: null,
        });
      }

      const result = await AttendenceCollection.insertOne(req?.body);
      res.send({
        success: true,
        message: "Attendence recorded succesfully!",
        data: result,
      });
    });
    // attendence history
    app.get("/subject/:subjectId/attendence/history", async (req, res) => {
      // demo date - d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear()
      // demo - dd/mm/yyyy
      const date = req?.query?.date;
      const subjectId = req?.params?.subjectId;

      const result = await AttendenceCollection.findOne({ subjectId, date });
      res.send({
        success: true,
        message: "Attendence found!",
        data: result,
      });
    });

    // end of routes
  } catch (err) {
    console.log(err);
  }
}
run();

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
