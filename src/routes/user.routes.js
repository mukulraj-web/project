import {Router} from "express";
import registerUser from "../controllers/user.controller.js"

console.log("REGISTER USER IMPORT =", registerUser);

const router = Router()

router.route("/register").post(registerUser)



// router.route("/login").post(login)



export default router