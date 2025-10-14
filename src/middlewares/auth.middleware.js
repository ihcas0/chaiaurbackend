import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => { // actually response is not used so _ is used ... also next is used to pass the control to next middleware or controller
   try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
 
    if (!token) {
     return res.status(401).json({message: "Access denied. No token provided"})
    }
 
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
    const user = await User.findById(decodedToken._id).select("-password -refreshToken")
 
    if(!user){
     // Discuss about frontend handling of this
     throw new ApiError(404, "User not found")
    }
 
    req.user = user // attaching the user to the req object so that we can use it in the next middleware or controller
    next()
   } catch (error) {
    throw new ApiError(401, "Invalid or expired token")
   }
})