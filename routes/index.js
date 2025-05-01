var express = require("express");
var router = express.Router();

module.exports = function (db) {
  router.get("/", function (req, res, next) {
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        // If users table is not empty, set up req.session.user and redirect to /dashboard
        req.session.user = data.rows[0];
        return res.redirect("/dashboard");
      }

      // If users table is empty, render the index page
      res.render("index", { title: "Polines" });
    });
  });

  router.post("/", function (req, res) {
    const { nama_pengguna } = req.body;
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        // User already exists
        req.session.user = data.rows[0];
        return res.redirect("/dashboard");
      }

      // User does not exist, insert into database
      db.query(
        "INSERT INTO users (nama_pengguna) VALUES ($1) RETURNING *",
        [nama_pengguna],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.send(err);
          }

          req.session.user = result.rows[0];
          res.redirect("/dashboard");
        }
      );
    });
  });

  //logout
  router.post("/logout", function (req, res) {
    const userId = req.session.user?.id_user;

    if (!userId) {
      return res.redirect("/");
    }

    db.query("DELETE FROM users WHERE id_user = $1", [userId], (err) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      req.session.destroy((err) => {
        if (err) {
          console.log(err);
          return res.send(err);
        }
        res.redirect("/");
      });
    });
  });

  // error handler

  return router;
};
//   = router;
