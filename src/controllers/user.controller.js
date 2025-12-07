import { asyncHandler } from "../utils/asyncHandler.js";
// console.log("Checking !!!!")
console.log("Controller file loaded!");

const registerUser = asyncHandler(async (req,res) => {
    res.status(200).json({
        message:"ok",
    })
})

 export default registerUser;