import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

app.get("/", (req, res) => {
	res.render("index.ejs", {
		title: "Main page",
	});
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
