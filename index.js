const express = require("express");
const app = express();
const mongoose = require("mongoose");
const stripe = require("stripe")(
    "sk_test_51N8RpsSGuEewPIK7HE7t3OwnXqviVPWoqddhQ1XvTRWwqB7KDBFbKkdXX1SPCRCcZreHJS1xmUKB2eOtauZtNgNI00UND9Ekjw"
);
const { User } = require("./database");
const ejs = require("ejs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const bodyParser = require("body-parser");

// middlewares for req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: false }));

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(
    session({
        secret: "your-secret-key",
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection string
const connectionString = "mongodb://localhost:27017/userDetails";

// Connect to MongoDB
mongoose
    .connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Connected to MongoDB");
        // Additional code or function calls can be placed here
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });

passport.use(
    new LocalStrategy(async(username, password, done) => {
        try {
            const user = await User.findOne({ username });
            if (!user) return done(null, false);
            if (user.password !== password) return done(null, false);
            return done(null, user);
        } catch (error) {
            return done(error, false);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialization: Retrieving user information from the session
passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

const trainData = {
    12028: { from: "SBC", to: "MGR", fare: 300 },
    23412: { from: "SBC", to: "SCH", fare: 250 },
    15937: { from: "KAWR", to: "MAQ", fare: 70 },
    99861: { from: "MYS", to: "MYA", fare: 40 },
    47243: { from: "HAS", to: "MAQ", fare: 48 },
};

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("success", (req, res) => {
    res.render("success");
});

app.get("invalid", (req, res) => {
    res.render("invalid");
});

app.get("/form", (req, res) => {
    // Assuming req.user.email contains the authenticated user's email
    // Render the EJS file and pass the userEmail as a local variable
    res.render("form.ejs");
});

const validStationCodes = [
    "SBC",
    "MYS",
    "MGR",
    "SCH",
    "KAWR",
    "MAQ",
    "HAS",
    "MYA",
];

app.post("/", async(req, res) => {
    const trainNo = req.body.trainNo;
    const fromStationCode = req.body.fromStationCode;
    const toStationCode = req.body.toStationCode;

    try {
        // Check if trainNo exists and both station codes are valid
        if (
            trainData.hasOwnProperty(trainNo) &&
            isValidStationCode(fromStationCode) &&
            isValidStationCode(toStationCode) &&
            fromStationCode !== toStationCode // Additional check for different station codes
        ) {
            const fare = trainData[trainNo].fare;
            res.render("result", { fare });
        } else {
            res.render("error", {
                error: "Invalid train details or station codes.",
            });
        }
    } catch (error) {
        res.render("error", {
            error: "An error occurred while fetching the fare.",
        });
    }
});

function isValidStationCode(stationCode) {
    // Check if station code is valid
    return validStationCodes.includes(stationCode);
}

app.post(
    "/login",
    passport.authenticate("local", {
        failureRedirect: "/login",
        successRedirect: "/form",
    })
);

app.post("/register", async(req, res) => {
    const user = await User.findOne({
        username: req.body.username,
        password: req.body.password,
    });
    if (user)
        return res.status(400).send("USER EXISTS OR CHOOSE UNIQUE PASSWORD");
    const newUser = await User.create(req.body);
    res.status(200).send("SUCCESFULL");
});

app.post("/processPayment", async(req, res) => {
    const price = req.body.price; // Retrieve the price from the submitted form data

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
            price_data: {
                currency: "inr",
                product_data: {
                    name: "Ticket Price", // Replace with your product name
                },
                unit_amount: price * 100, // Stripe uses the amount in cents, so multiply by 100
            },
            quantity: 1,
        }, ],
        mode: "payment",
        success_url: "http://localhost:5000/success", // Replace with your success URL
        cancel_url: "http://localhost:5000/invalid", // Replace with your cancel URL
    });

    // Redirect the user to the Stripe Checkout page
    res.redirect(303, session.url);
});

app.listen(5000, () => {
    console.log("server ruuning on port no 5000");
});