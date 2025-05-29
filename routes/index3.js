const express = require("express");
const router = express.Router();

module.exports = function (db) {
  router.get("/", function (req, res, next) {
    if (req.session.user) {
      return res.redirect("/dashboard");
    }
    res.render("index", { title: "Polines" });
  });

  router.post("/", function (req, res) {
    const { nama_pengguna } = req.body;

    if (!nama_pengguna) {
      return res.status(400).send("Nama pengguna harus diisi");
    }

    db.query(
      "SELECT * FROM users WHERE nama_pengguna = $1",
      [nama_pengguna],
      (err, data) => {
        if (err) {
          console.log(err);
          return res.status(500).send("Terjadi kesalahan saat login");
        }

        if (data.rows.length > 0) {
          req.session.user = data.rows[0];
          return res.redirect("/dashboard");
        }

        // Jika belum ada, buat user baru
        db.query(
          "INSERT INTO users (nama_pengguna) VALUES ($1) RETURNING *",
          [nama_pengguna],
          (err, result) => {
            if (err) {
              console.log(err);
              return res.status(500).send("Gagal membuat user");
            }

            req.session.user = result.rows[0];
            res.redirect("/dashboard");
          }
        );
      }
    );
  });

  router.post("/logout", function (req, res) {
    // Hapus hanya session, bukan user
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Gagal logout");
      }
      res.redirect("/");
    });
  });

  return router;
};
