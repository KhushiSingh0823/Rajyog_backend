// controllers/blogController.js
import Blog from "../models/blog.model.js";

// CREATE BLOG
export const createBlog = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    const { title, content, category, shortDesc } = req.body;

    const blog = new Blog({
      title,
      shortDesc,
      content,
      category,
      image: req.file ? `/uploads/blogs/${req.file.filename}` : null,
    });

    await blog.save();
    res.status(201).json({ message: "Blog created successfully", blog });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create blog" });
  }
};

// GET ALL BLOGS + SEARCH
export const getAllBlogs = async (req, res) => {
  try {
    const search = req.query.search || "";

    const blogs = await Blog.find({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    res.json(blogs);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to fetch blogs" });
  }
};

// GET SINGLE BLOG
export const getBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to fetch blog" });
  }
};

// UPDATE BLOG
export const updateBlog = async (req, res) => {
  try {
    const { title, content, category, shortDesc } = req.body;

    const updatedData = {
      title,
      shortDesc,
      content,
      category,
    };

    if (req.file) {
      updatedData.image = `/uploads/blogs/${req.file.filename}`;
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
    });

    res.json({ message: "Blog updated successfully", blog });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update blog" });
  }
};

// DELETE BLOG
export const deleteBlog = async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to delete blog" });
  }
};

// ENABLE / DISABLE BLOG STATUS
export const toggleBlogStatus = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.status = blog.status === "enabled" ? "disabled" : "enabled";
    await blog.save();

    res.json({
      message: `Blog ${blog.status === "enabled" ? "enabled" : "disabled"} successfully`,
      blog,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update status" });
  }
};

// ===========================================================
//                   LIKE / DISLIKE / COMMENTS
// ===========================================================

// LIKE BLOG
export const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Remove dislike if exists
    blog.dislikes = blog.dislikes.filter(
      (uid) => uid.toString() !== req.user._id.toString()
    );

    const alreadyLiked = blog.likes.some(
      (uid) => uid.toString() === req.user._id.toString()
    );

    // Toggle like
    if (alreadyLiked) {
      blog.likes = blog.likes.filter(
        (uid) => uid.toString() !== req.user._id.toString()
      );
    } else {
      blog.likes.push(req.user._id);
    }

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Failed to like blog" });
  }
};

// DISLIKE BLOG
export const dislikeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Remove like if exists
    blog.likes = blog.likes.filter(
      (uid) => uid.toString() !== req.user._id.toString()
    );

    const alreadyDisliked = blog.dislikes.some(
      (uid) => uid.toString() === req.user._id.toString()
    );

    // Toggle dislike
    if (alreadyDisliked) {
      blog.dislikes = blog.dislikes.filter(
        (uid) => uid.toString() !== req.user._id.toString()
      );
    } else {
      blog.dislikes.push(req.user._id);
    }

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Failed to dislike blog" });
  }
};

// ADD COMMENT
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.comments.push({
      user: req.user._id,
      text,
    });

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment" });
  }
};

// DELETE COMMENT
export const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.comments = blog.comments.filter(
      (c) => c._id.toString() !== commentId.toString()
    );

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// GET COMMENTS OF A BLOG
export const getComments = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "comments.user",
      "name email"
    );

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog.comments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};
