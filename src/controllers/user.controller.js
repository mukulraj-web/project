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
    process.env.REFRESH_TOKEN_SECRET
  )
  const user = await User.findById(decodedToken?._id)
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
const changeCurrentpassword = asyncHandler(async(req,res)=>
{
    const {oldPassword, newPassword, /*confirmPassword*/} = req.body
    // if(!(newPassword === confirmPassword)){
    //     throw new ApiError(400, "new password and confrm password are not same.")
    // }
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false})
    return res
    .status(200)
    .json(new ApiResponse(200, {}, "password saved successfully"))
})
const getCurrentuser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateUserDetail = asyncHandler(async (req,res)=> {
    const {fullname, email} = req.body
    if(!fullname || !email){
        throw new ApiError(400, "All fields are reqiured")
    }
     const user = User.findByIdAndUpdate(req.user?._id,
            {
                $set: {
                    fullname,
                    email:email
                }
            },
            {new: true}
        ).select("-password")
        return res
        .status(200)
        .json(new ApiResponse(200, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res)=> 
    {
        const avatarLocalPath = req.file?.path
        if(!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is missing")
        }
        const avatar =await  uploadOnCloudinary(avatarLocalPath)
        if(!avatar.url){
            throw new ApiError(500, "Error while uploading avatar" )
        }

       const user  = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {new: true}
        ).select("-password")

        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "avatar updated succesfully")
        )

})
const updateUserCoverImage = asyncHandler(async (req,res)=> {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        return new ApiError(400, "cover image file is missing.")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        return new ApiError(500, "Error while uploading the cover image.")
    }
    const user = User.findbyIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage:coverImage
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully" )
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=> {
    const {username} = req.param
    if(!username?.trim()) {
        throw new ApiError(400, "Username is misssing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then : true,
                        else: false
                    }
                }

            }
        },
        {
            $project: {
                fullname: 1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])
    if(!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully.")
    )
})

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                {
                    $lookup: {
                        from: "User",
                        localField: "owner",
                        foreignField:"_id",
                        as: "owner",
                        pipeline: {
                            $project: {
                                fullname: 1,
                                username:1,
                                avatar:1
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        owner: {
                            $first: "owner"
                        }
                    }
                }
                ]   
            }
        }
    ])

    return res
    .status(200)
    .json(
       new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history successfully fetched!"

       ) 
    )
})

 export {registerUser,
     loginUser,
      logoutUser,
       refreshAccessToken,
       changeCurrentpassword,
       getCurrentuser,
       updateUserDetail,
       updateUserAvatar,
       updateUserCoverImage,
       getUserChannelProfile,
       getWatchHistory
    };