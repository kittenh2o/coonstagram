const express = require("express"),
      app = express(),
      bodyParser = require("body-parser"),
      mongoose = require("mongoose"),
      methodOverride = require("method-override"),
      expressSanitizer = require("express-sanitizer"),
      seedDB = require("./seeds"),
      passport = require("passport"),
      LocalStrategy = require("passport-local"),
      expressSession = require("express-session"),
      flash = require("connect-flash");
      

// import models
const User = require("./models/user");


// Require routes
const photoRoutes = require("./routes/photos"),
      commentRoutes = require("./routes/comments"),
      indexRoutes = require("./routes/index"),
      likeAndFavourRoutes = require("./routes/likesAndFavourites");


require("dotenv").config();

mongoose.connect(process.env.DB_URL, {useNewUrlParser: true});

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(methodOverride("_method"));
app.use(expressSanitizer());
app.use(express.static(__dirname+"/public"));
app.use(flash());

// seedDB();  // Seed the database

app.locals.moment = require("moment");

// PASSPORT CONFIGURATION
app.use(expressSession({
    secret: "Yelp Yelp",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next)=>{
    res.locals.currentUser = req.user;
    res.locals.message = {
        danger: req.flash("danger"),
        info: req.flash("info"),
        warning: req.flash("warning"),
        success: req.flash("success")
    };
    next();
});


// Use routes
app.use(indexRoutes);
app.use("/photos", photoRoutes); //common route prefix 
app.use(commentRoutes);
app.use(likeAndFavourRoutes);


app.listen(process.env.PORT, process.env.IP, ()=>console.log("Coonstagram server started."));