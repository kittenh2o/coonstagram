const express = require("express"),
      router = express.Router(),
      middleware = require("../middleware"), //automatically require index.js in this folder
      multer = require("multer"),
      cloudinary = require("cloudinary");


// import models
const Profile = require("../models/profile"),
      Photo = require("../models/photo");



require("dotenv").config();


const storage = multer.diskStorage({
    filename: function(req, file, callback){
        callback(null, Date.now() + file.originalname);
    }
});


const imageFilter = function(req, file, cb){
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({storage: storage, fileFilter: imageFilter});


cloudinary.config({
    cloud_name: 'dwf6x1ohn',
    api_key: process.env.cloudinary_api_key,
    api_secret: process.env.cloudinary_api_secret
});

const isLoggedIn = middleware.isLoggedIn,
      checkPhotoOwnership = middleware.checkPhotoOwnership;


// 1.INDEX - show all photos
router.get("/", async function showAllPhotos(req, res){
    let perPage = 8;
    let pageQuery = parseInt(req.query.page);
    let pageNumber = pageQuery? pageQuery:1;

    try{
        let [count, allPhotos] = await Promise.all([
            Photo.countDocuments().exec(),
            Photo.find({}).sort("-created").skip(perPage*(pageNumber-1))
                                            .limit(perPage).exec()
            ]);

        res.render("photos/index",{
            photos: allPhotos,
            current: pageNumber,
            pages: Math.ceil(count/perPage)
        });

    } catch(err){
        console.log(err);
    }
});


// 2.NEW - Show form to create new photos
router.get("/new", isLoggedIn,(req, res)=>{
    res.render("photos/new");
});


// 3.CREATE - add photo to DB
router.post("/", isLoggedIn, upload.single("image"), function createPhoto(req, res){
    cloudinary.v2.uploader.upload(req.file.path, (err,result)=>{
        if(err){
            console.log(err);
            req.flash("danger", err.message);
            return res.redirect('back');
        }
        // add cloudinary url for the image
        let newPhoto = req.body.photo;
        newPhoto.image = result.secure_url;
        newPhoto.cloudId = result.public_id;
        newPhoto.author = {
            id: req.user._id,
            username: req.user.username
        };

        Photo.create(newPhoto, (err, thePhoto) =>{
            if(err){
                console.log(err);
                req.flash('danger', err.message);
                return res.redirect('back');
            } else{
                req.flash("success", "Successfully uploaded!");
                res.redirect("/photos/"+ thePhoto._id);
            }
        });        
    });

});


// 4.SHOW - Shows info about one photo
router.get("/:id", async function showPhotoInfo(req, res){
    try{
        // find the photo with the provided id
        let foundPhoto = await Photo.findById(req.params.id)
                                    .populate({
                                        path: "comments",
                                        options: {sort: {created: -1}}
                                    }).exec();

        let isLiked = false;
        let isFavoured = false;

        if(req.isAuthenticated())
        {
            let currentUserProfile = await Profile.findById(req.user.profile._id)
                                                    .populate("likes")
                                                    .populate("favourites").exec();
            // eval(require('locus'));
            for(let like of currentUserProfile.likes){
                if(like.photoId.equals(req.params.id)){
                    isLiked = true;
                    break;
                }
            }

            for(let favour of currentUserProfile.favourites){
                if(favour.photoId.equals(req.params.id)){
                    isFavoured = true;
                    break;
                }
            }
        }

        res.render("photos/show", {
            photo: foundPhoto, 
            hasLiked: isLiked, 
            hasFavoured: isFavoured
        });

    } catch(err){
        console.log(err);
        req.flash("warning", err.message);
        return res.redirect("/photos");
    }

});


// 5.EDIT
router.get("/:id/edit", checkPhotoOwnership, function editPhoto(req, res){
    Photo.findById(req.params.id, (err, foundPhoto)=>{
        res.render("photos/edit", {photo: foundPhoto});
    });
});


// 6.UPDATE
router.put("/:id", checkPhotoOwnership, async function updatePhoto(req, res){
    // Find and update the photo
    try{
        await Photo.findByIdAndUpdate(req.params.id, req.body.photo).exec();
        req.flash("success", "Successfully updated photo!");

    } catch(err){
        req.flash("danger", err.message);

    } finally {
        res.redirect("/photos/"+ req.params.id); // Redirect back to the show page
    }

});


//7.DESTROY
router.delete("/:id", checkPhotoOwnership, async function deletePhoto(req, res){

    try{
        let thePhoto = await Photo.findById(req.params.id).exec();
        if(thePhoto.cloudId)
            await cloudinary.v2.uploader.destroy(thePhoto.cloudId); //remove from cloudinary

        thePhoto.remove();
        req.flash("success", "Photo successfully deleted!");

    } catch(err){
        console.log(err);
        req.flash("danger", err.message);

    } finally {
        res.redirect("/photos");
    }
});






module.exports = router;