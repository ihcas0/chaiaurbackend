import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()

         user.refreshToken = refreshToken
         await user.save({validateBeforeSave: false}) // we don't want to validate the password again while saving the refresh token

         return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Token generation failed" + error.message)
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "User registered successfully" }); 
    //get user details from frontend
    //validate user details - not empty
    //check if user already exists:username or email
    // check for images , check for avatar 
    // upload them to cloudinary,avatar 
    // creater user object and save to db
    //remove password and respose token field from response
    // check for user creation success
    //return res

    const {fullName, username, email, password} = req.body
    
    // if(!fullName || !username || !email || !password){
    //     return res.status(300).json({
    //         success: false,
    //         message: "All fields are required"
    //     })
    // }   
    //Now let's write some production grade code
    if ([fullName, username, email, password].some((field) => !field || field.trim() === "")) 
        {
  throw new ApiError(400, "All fields are required");
}

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {

        throw new ApiError(400, "Invalid email format");
}

const existingUser = await User.findOne({
    $or: [{email}, {username}]
})
if(existingUser){
    throw new ApiError(409, "User already exists with this email or username")
}

const avatarLocalPath = req.files?.avatar[0]?.path
// const coverImageLocalPath = req.files?.coverImage[0]?.path // this is when we know that cover image is sent from frontend otherwise it will be undefined and issues 

let coverImageLocalPath;
if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;  // This is classic way to check if cover image is sent from frontend or not
}

if (!avatarLocalPath){
    throw new ApiError(400, "Avatar image is required")
}

const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage = await uploadOnCloudinary(coverImageLocalPath)


if (!avatar) {
    throw new ApiError(500, "Failed to upload avatar image");
}

 const user = await User.create({
    fullName,
    avatar: avatar.url
    ,coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
})

 const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if(!createdUser){

        throw new ApiError(500, "User creation failed")
    }

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"))
    console.log(req.body);
    
})

const loginUser = asyncHandler(async (req, res) => {
    // req body --> data
    // username or email 
    // find user based on username or email
    // password compare
    // access and refresh token
    // send cookie(actually secure http only cookie) with refresh token ... just sending cookie from backend to frontend

  const { email, username, password } = req.body;

  if (!(username && email)) {
    throw new ApiError(400, "Username and email is required to login");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User not found with this email or username");
  }

  const ifPasswordValid = await user.isPasswordCorrect(password);

  if (!ifPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true, // only works on https
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
}); // ✅ loginUser properly closed here

// define logoutUser separately
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
    expires: new Date(0),
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(400, "Refresh token is required")
    }
   
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
       const user = await User.findById(decodedToken?._id)
    
       if(!user){
        throw new ApiError(404, "Invalid refresh token - user not found")
       }
    
        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
         const {accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id)
    
         return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newrefreshToken, options)
         .json(new ApiResponse(200, {accessToken, newrefreshToken}, "Access token has been refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid or expired refresh token")
    }
})

export { registerUser, loginUser, logoutUser };
