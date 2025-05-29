// Memuat modul Express
var express = require("express");
// Membuat router baru untuk menangani route khusus
var router = express.Router();

// Mengekspor fungsi utama yang menerima objek db (koneksi database)
module.exports = function (db) {
  // Route GET untuk halaman utama ("/")
  router.get("/", function (req, res, next) {
    // Jika pengguna sudah login (tersimpan di session), redirect ke dashboard
    if (req.session.user) {
      return res.redirect("/dashboard");
    }

    // Jika belum login, render halaman index (halaman awal)
    res.render("index", { title: "Polines" });
  });

  // Route POST untuk login atau mendaftar user baru (biasanya dikirim dari form)
  router.post("/", function (req, res) {
    // Mengambil nilai 'nama_pengguna' dari form input (body request)
    const { nama_pengguna } = req.body;

    // Mengecek apakah sudah ada user di database (ambil semua data users)
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        // Jika terjadi error saat query, tampilkan error ke konsol dan kirim ke client
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        // Jika user sudah ada (tabel users tidak kosong), anggap user pertama sebagai yang login
        req.session.user = data.rows[0]; // Simpan data user ke session
        return res.redirect("/dashboard"); // Redirect ke dashboard
      }

      // Jika user belum ada di database, maka masukkan user baru ke tabel users
      db.query(
        "INSERT INTO users (nama_pengguna) VALUES ($1) RETURNING *", // Query untuk insert user baru
        [nama_pengguna], // Data yang dimasukkan ke query
        (err, result) => {
          if (err) {
            // Jika error saat insert, tampilkan dan kirim error
            console.log(err);
            return res.send(err);
          }

          // Simpan user baru yang berhasil dibuat ke session
          req.session.user = result.rows[0];
          // Redirect ke dashboard
          res.redirect("/dashboard");
        }
      );
    });
  });

  // Route POST untuk logout user (biasanya dipicu dari tombol logout)
  router.post("/logout", function (req, res) {
    // Ambil ID user dari session, jika ada
    const userId = req.session.user?.id_user;

    // Jika tidak ada user di session, langsung redirect ke halaman utama
    if (!userId) {
      return res.redirect("/");
    }

    // Hapus data user dari database berdasarkan id
    db.query("DELETE FROM users WHERE id_user = $1", [userId], (err) => {
      if (err) {
        // Jika error saat menghapus, tampilkan error dan kirim ke client
        console.log(err);
        return res.send(err);
      }

      // Setelah user dihapus, hapus juga session
      req.session.destroy((err) => {
        if (err) {
          // Jika error saat menghapus session, tampilkan dan kirim error
          console.log(err);
          return res.send(err);
        }

        // Setelah logout berhasil, redirect ke halaman utama
        res.redirect("/");
      });
    });
  });

  // Mengembalikan router agar bisa digunakan di file utama (app.js)
  return router;
};
