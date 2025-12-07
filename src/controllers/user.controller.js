import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
// console.log("Controller file loaded!");

const registerUser = asyncHandler(async (req,res) => {
     const {fullname, email, username, password} = req.body;
     console.log("email: ",email );
     if([fullname, email, username, password].some((field)=>
        field?.trim() === "")
    )  {
        throw new ApiError(400, "All fields are required");
     }
    const existedUser = User.findOne({
        $or: [{username},{email}]
     })
     console.log("the current user existence is: ",existedUser);
     if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
     }

     const avatarLocalPath = req.files?.avatar[0].path;
     console.log("the local file path is : ", avatarLocalPath);
     const coverImageLocalPath = req.files?.coverImage[0].path;
     console.log("the local path of the cover image is : ", coverImageLocalPath);

     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
     }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
     throw new ApiError(400, "Avatar file is required ")   
    }
    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    const createdUser = user.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered succesfully" )
    )
})

 export default registerUser;