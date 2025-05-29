// Memuat modul Express
var express = require("express");
var router = express.Router();

module.exports = function (db) {
  // GET: Halaman utama (login)
  router.get("/", function (req, res, next) {
    if (req.session.user) {
      return res.redirect("/dashboard");
    }
    res.render("index", { title: "Polines" });
  });

  // POST: Login atau daftar user baru
  router.post("/", function (req, res) {
    const { nama_pengguna } = req.body;

    if (!nama_pengguna || nama_pengguna.trim() === "") {
      return res.status(400).send("Nama pengguna tidak boleh kosong");
    }

    // Cari user berdasarkan nama_pengguna
    db.query(
      "SELECT * FROM users WHERE nama_pengguna = $1",
      [nama_pengguna],
      (err, data) => {
        if (err) {
          console.log(err);
          return res.send(err);
        }

        if (data.rows.length > 0) {
          // Jika user sudah ada, gunakan user tersebut
          req.session.user = data.rows[0];
          return res.redirect("/dashboard");
        }

        // Jika belum ada, tambahkan user baru
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
      }
    );
  });

  // POST: Logout user
  router.post("/logout", function (req, res) {
    if (!req.session.user) {
      return res.redirect("/");
    }

    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      res.redirect("/");
    });
  });

  return router;
};
