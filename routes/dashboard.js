var express = require("express");
var router = express.Router();

module.exports = function (db) {
  /* GET home page. */
  router.get("/", function (req, res, next) {
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        // If users table is not empty, set up req.session.user and redirect to /dashboard
        req.session.user = data.rows[0];
        return res.render("dashboard/dashboard", { title: "Polines" });
      }

      // If users table is empty, render the index page
      return res.redirect("/");
    });
  });

  // POST
  router.post("/", function (req, res, next) {
    const {
      mode = null,
      kp = null,
      ki = null,
      kd = null,
      set_point = null,
      time_sampling = null,
    } = req.body;
    if (!req.session.user) {
      db.query("SELECT * FROM users LIMIT 1", (err, data) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).send("Database query error");
        }

        if (data.rows.length > 0) {
          req.session.user = data.rows[0];
        } else {
          return res.redirect("/");
        }
      });
    }
    const query = `
      UPDATE users
      SET setpoint = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, mode_kendali = $6
      WHERE id_user = $7
      `;
    const values = [
      set_point,
      kp,
      ki,
      kd,
      time_sampling,
      mode,
      req.session.user.id_user, // Assuming `id` is passed in the request body
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      res.status(200).send("Data added successfully");
    });
    // console.log("INI YANG POST DARI DEPAN", req.body, req.session.user);
    //Disini seharusnya esp mendapatkan daata
  });
  return router;
};
