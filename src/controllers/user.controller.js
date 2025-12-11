import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";
// console.log("Controller file loaded!");

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user =  await User.findById(userId);
        // console.log(user)
        const accessToken = user.generateAccessToken();
        // console.log("access token is ",accessToken)
        const refreshToken = user.generateRefreshToken();
        // console.log("refresh token : ", refreshToken)
        user.refreshToken = refreshToken;
        console.log("Saving user with refresh token", refreshToken);
        console.log("User object: ", user)
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken}

    } catch(err){
        throw new ApiError(500, "something went wrong while generating refresh and access token.")
    }
}

const registerUser = asyncHandler(async (req,res) => {
     const {fullname, email, username, password} = req.body;
    //  console.log("email: ",email );
     if([fullname, email, username, password].some((field)=>
        field?.trim() === "")
    )  {
        throw new ApiError(400, "All fields are required");
     }
    const existedUser = await User.findOne({
        $or: [{username},{email}]
     })
    //  console.log("the current user existence is: ",existedUser);
     if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
     }
     // logging the req files
    //  console.log("REQ. FILES: ",req.files);
     const avatarLocalPath = req.files?.avatar[0].path;
    //  console.log("the local file path is : ", avatarLocalPath);
    //  const coverImageLocalPath = req.files?.coverImage[0].path;
    // if(!coverImageLocalPath == ""){ 
    // console.log("the local path of the cover image is : ", coverImageLocalPath);
    // }

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ){
        coverImageLocalPath = req.files.coverImage[0].path
    }

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
    // console.log("user creation completed back to user.controllers.js")
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
);

})

const loginUser = asyncHandler(async (req,res) => {

    const {email, username, password} = req.body;
    /*
    console.log("request is : ",req.body);
    console.log("email is: ", email)
    console.log("email is : ",req.body["email"])
    console.log("password is : ",req.body["password"])
*/
    if(!username && !email){
        throw new ApiError(400, "Username or email is required!")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    if(!user){
        throw new ApiError(404, "user doesnot exists");
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await  User.findById(user._id).
    select("-password -refreshToken");
    

    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
             "User logged in Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
    req.user._id,
    {
        $set:  {
            refreshToken : undefined
        },
     },
        {
            new:  true
        }
   
    )
    const options = {
        httpOnly : true,
        secure: true
    }  
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out."))

})
const refreshAccessToken = asyncHandler(async (req,res)=> {
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken;
  if(!incomingRefreshToken){
    throw new ApiError(401, "unauthrized request")
  }
  try {
    const decodedToken = jwt.verify(
    incomingRefreshToken,
    REFRESH_TOKEN_SECRET
  )
  const user = await User.fingdById(decodedToken?._id)
  if(!user){
    throw new ApiError(401, "Invalid refresh Token")
    }
    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used.")
    }
    const options = {
        httpOnly: true,
        secured: true
    }
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    return res
    .status(200)
    .cookie("access token",accessToken)
    .cookie("refresh token",newRefreshToken)
    .json(
        new ApiResponse(
            200,
            {accessToken,newRefreshToken },
            "Accesss token refreshed"
        )
    )
  } catch(error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})
 export {registerUser, loginUser, logoutUser, refreshAccessToken};