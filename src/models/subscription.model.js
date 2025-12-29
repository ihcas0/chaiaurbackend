import mongoose, { Schema } from "mongoose";

const SubscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // One who subscribes
        ref: "User",
        
    },
    channel: {
        type: Schema.Types.ObjectId, // One who is being subscribed to
        ref: "User",
    }
})

export const Subscription = mongoose.model("Subscription", SubscriptionSchema);