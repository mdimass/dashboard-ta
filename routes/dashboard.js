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

    // Debugging: Cek nilai yang diterima
    console.log("Received values:", {
      mode,
      kp,
      ki,
      kd,
      set_point,
      time_sampling,
    });

    // Cek apakah user sudah ada di session
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

    // Ganti string kosong dengan '0'
    const values = [
      set_point || "0", // Ganti set_point kosong dengan '0'
      kp === "" ? "0" : kp, // Jika kp kosong, ganti dengan '0'
      ki === "" ? "0" : ki, // Jika ki kosong, ganti dengan '0'
      kd === "" ? "0" : kd, // Jika kd kosong, ganti dengan '0'
      time_sampling || "0", // Ganti time_sampling kosong dengan '0'
      mode,
      req.session.user ? req.session.user.id_user : null, // Pastikan user ada
    ];

    // Validasi input
    for (let i = 0; i < 5; i++) {
      if (values[i] === null || values[i] === "") {
        return res.status(400).send(`Invalid input for parameter ${i + 1}`);
      }
    }

    const query = `
      UPDATE users
      SET setpoint = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, mode_kendali = $6
      WHERE id_user = $7
    `;

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      res.status(200).send("Data updated successfully");
    });
  });

  return router;
};
