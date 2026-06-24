const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://vitalis-client-pi.vercel.app", // ⭐ তোমার Vercel URL দাও
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ msg: "Unauthorize" });
  }
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ msg: "Unauthorize" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ msg: "Unauthorize" });
  }
};

const trainerVerify = async (req, res, next) => {
  const user = req.user;
  if (user.role !== "trainer") {
    return res.status(403).json({ msg: "Forbidden" });
  }
  next();
};

const memberVerify = async (req, res, next) => {
  const user = req.user;
  if (user.role !== "member") {
    return res.status(403).json({ msg: "Forbidden" });
  }
  next();
};

client.connect().catch(console.dir);

const db = client.db("vitals");
const classCollection = db.collection("allClasses");
const subscriptionsCollection = db.collection("subscriptions");
const bookClassCollection = db.collection("bookClasses");
const favoriteCollection = db.collection("favorite");
const forumPostCollection = db.collection("forumPost");
const trainerApplicationCollection = db.collection("application");
const userCollection = db.collection("user");

//User
app.get("/api/all-users", async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

// All Classes
app.get("/api/all-class", async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;
    const query = {};
    if (search) query.className = { $regex: search, $options: "i" };
    if (category && category !== "All Categories") query.category = category;
    const result = await classCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send({ message: error.message });
  }
});

app.get("/api/all-classes/:id", verifyToken, async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const result = await classCollection.findOne(query);
  res.send(result || {});
});

app.get("/api/getmyclasses", async (req, res) => {
  const { trainerId } = req.query;
  const query = { authorId: trainerId };
  const result = await classCollection.find(query).toArray();
  res.send(result || {});
});

app.post("/api/add-class", verifyToken, trainerVerify, async (req, res) => {
  const data = req.body;
  const newData = {
    ...data,
    createdAt: new Date(),
  };
  const result = await classCollection.insertOne(newData);
  res.send(result);
});

app.patch("/api/all-classes/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const result = await classCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData },
  );
  res.send(result);
});

app.delete("/api/my-class/:id", async (req, res) => {
  const { id } = req.params;
  const result = await classCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Subscription
app.post("/api/subscription", async (req, res) => {
  const { sessionId, userId, priceId } = req.body;
  const isExist = await subscriptionsCollection.findOne({ sessionId });
  if (isExist) return res.json({ msg: "Already exist!" });
  await subscriptionsCollection.insertOne({ sessionId, userId, priceId });
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { plan: "pro" } },
  );
  res.json({ msg: "Payment Successfully!" });
});

// Forum posts
app.get("/api/forumPost", async (req, res) => {
  const result = await forumPostCollection.find().toArray();
  res.send(result);
});
app.get("/api/my-forumPost", async (req, res) => {
  const { userId } = req.query;
  const query = { userId: userId };
  const result = await forumPostCollection.find(query).toArray();
  res.send(result);
});
app.get("/api/forumPost/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await forumPostCollection.findOne(query);
  res.send(result);
});
app.post("/api/forumPost", async (req, res) => {
  const newPost = { ...req.body, createdAt: new Date(), status: "pending" };
  const result = await forumPostCollection.insertOne(newPost);
  res.status(200).json(result);
});

app.delete("/api/my-post/:id", async (req, res) => {
  const { id } = req.params;
  const result = await forumPostCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

//Like toggle
app.post("/api/forum/like", async (req, res) => {
  const { postId, userId } = req.body;
  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });

  const likes = post.likes || [];
  const alreadyLiked = likes.includes(userId);

  if (alreadyLiked) {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $pull: { likes: userId } },
    );
    res.json({ liked: false, likeCount: likes.length - 1 });
  } else {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $push: { likes: userId } },
    );
    res.json({ liked: true, likeCount: likes.length + 1 });
  }
});

//Comment add
app.post("/api/forum/comment", async (req, res) => {
  const { postId, userId, userName, userImage, userRole, content } = req.body;
  const comment = {
    _id: new ObjectId(),
    userId,
    userName,
    userImage: userImage || null,
    userRole,
    content,
    likes: [],
    replies: [],
    createdAt: new Date(),
  };
  await forumPostCollection.updateOne(
    { _id: new ObjectId(postId) },
    { $push: { comments: comment } },
  );
  res.json({ success: true, comment });
});

//comment edit
app.put("/api/forum/comment/:postId/:commentId", async (req, res) => {
  const { postId, commentId } = req.params;
  const { content, userId } = req.body;

  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });
  const comment = post.comments.find((c) => c._id.toString() === commentId);

  if (comment.userId !== userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await forumPostCollection.updateOne(
    { _id: new ObjectId(postId), "comments._id": new ObjectId(commentId) },
    { $set: { "comments.$.content": content, "comments.$.edited": true } },
  );

  res.json({ success: true, content });
});

// Comment delete
app.delete("/api/forum/comment/:postId/:commentId", async (req, res) => {
  const { postId, commentId } = req.params;
  const { userId } = req.body;

  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });
  const comment = post.comments.find((c) => c._id.toString() === commentId);

  if (comment.userId !== userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await forumPostCollection.updateOne(
    { _id: new ObjectId(postId) },
    { $pull: { comments: { _id: new ObjectId(commentId) } } },
  );

  res.json({ success: true });
});

// Comment like toggle
app.post("/api/forum/comment/like", async (req, res) => {
  const { postId, commentId, userId } = req.body;

  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });
  const comment = post.comments.find((c) => c._id.toString() === commentId);
  const likes = comment.likes || [];
  const alreadyLiked = likes.includes(userId);

  if (alreadyLiked) {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId), "comments._id": new ObjectId(commentId) },
      { $pull: { "comments.$.likes": userId } },
    );
    res.json({ liked: false, likeCount: likes.length - 1 });
  } else {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId), "comments._id": new ObjectId(commentId) },
      { $push: { "comments.$.likes": userId } },
    );
    res.json({ liked: true, likeCount: likes.length + 1 });
  }
});

// Reply add
app.post("/api/forum/reply", async (req, res) => {
  const { postId, commentId, userId, userName, userImage, userRole, content } =
    req.body;

  const reply = {
    _id: new ObjectId(),
    userId,
    userName,
    userImage: userImage || null,
    userRole,
    content,
    likes: [],
    createdAt: new Date(),
  };

  await forumPostCollection.updateOne(
    { _id: new ObjectId(postId), "comments._id": new ObjectId(commentId) },
    { $push: { "comments.$.replies": reply } },
  );

  res.json({ success: true, reply });
});

//api for member
// Booking
app.get("/api/getbookings", verifyToken, memberVerify, async (req, res) => {
  const { userId } = req.query;
  const query = { userId: userId };
  const result = await bookClassCollection.find(query).toArray();
  res.send(result);
});
app.get("/api/checkBooking", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await bookClassCollection.findOne({ userId, classId });
  res.status(200).json({ isBooked: !!existing });
});

app.post("/api/bookClass", async (req, res) => {
  const result = await bookClassCollection.insertOne(req.body);
  res.status(200).json(result);
});

// Favorites
app.get("/api/favorites", verifyToken, memberVerify, async (req, res) => {
  const { userId } = req.query;
  const favorites = await favoriteCollection.find({ userId }).toArray();
  res.status(200).json(favorites);
});

app.post("/api/favorites", async (req, res) => {
  const { userId, classId } = req.body;
  const existing = await favoriteCollection.findOne({ userId, classId });
  if (existing) {
    await favoriteCollection.deleteOne({ userId, classId });
    res
      .status(200)
      .json({ isFavorite: false, message: "Removed from favorites" });
  } else {
    await favoriteCollection.insertOne({ ...req.body, createdAt: new Date() });
    res.status(200).json({ isFavorite: true, message: "Added to favorites" });
  }
});

app.delete("/api/favorites", async (req, res) => {
  const { userId, classId } = req.body;
  const result = await favoriteCollection.deleteOne({ userId, classId });
  res.send(result);
});

app.get("/api/favorites/check", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await favoriteCollection.findOne({ userId, classId });
  res.status(200).json({ isFavorite: !!existing });
});

//Apply as Trainer
app.get(
  "/api/trainerApplication",
  verifyToken,
  memberVerify,
  async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const result = await trainerApplicationCollection.findOne({ userId });

    res.send(result || {});
  },
);

// Application check
app.get("/api/trainer-application/check", async (req, res) => {
  const { userId } = req.query;
  const existing = await trainerApplicationCollection.findOne({ userId });
  res.json({ hasApplied: !!existing, status: existing?.status || null });
});

// Application submit
app.post("/api/trainer-application", async (req, res) => {
  const { userId } = req.body;
  const existing = await trainerApplicationCollection.findOne({ userId });
  if (existing) {
    return res.status(400).json({ error: "Already applied!" });
  }
  const result = await trainerApplicationCollection.insertOne(req.body);
  res.json(result);
});

app.get("/", (req, res) => res.send("Hello World!"));

app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;
