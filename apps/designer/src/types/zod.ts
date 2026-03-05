import * as z from "zod";

export const fileUploadFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["man", "woman", "person", "style"]),
}); 