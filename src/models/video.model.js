import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"
const videoSchema = Schema(
    {
        videoFile: {
            type: string, // Cloudinary url
            required: true
        },
        thumbnail: {
             type: String, // cloudinary url
              required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: String, // clodinary url
            required: true
       },
       views: {
        type: Number,
        default: 0
       },
       ispublished: {
        type: Boolean,
        default: true,
       },
       owner: {
        type: Schema.Type.ObjectId,
        ref: "User"
       }
    }, 
    {timestamps: true}
)
videoSchema.plugin(mongooseAggregatePaginate)
export const Video = mongoose.model("Video", videoSchema)