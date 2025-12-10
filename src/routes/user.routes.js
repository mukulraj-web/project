import {Router} from "express";
import {registerUser, loginUser,logoutUser} from "../controllers/user.controller.js"
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
console.log("REGISTER USER IMPORT =", registerUser);

const router = Router()

router.route("/register").post(
    upload.fields([
       {name: "avatar",
        maxCount:1
       },{
        name: "coverImage",
        maxCount: 1
       } 
    ]),
    registerUser)

router.route("/login").post(loginUser)

// router.route("/login").post(login)

// Secured routes
router.route("/logout").post(verifyJWT,  logoutUser)


export default router