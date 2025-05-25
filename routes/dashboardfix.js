// Import library yang dibutuhkan
var express = require("express");
var mqtt = require("mqtt");
var router = express.Router();

// Konfigurasi koneksi MQTT
const mqttOptions = {
  username: "dimas", // username MQTT (disesuaikan dengan akun)
  password: "TaEKD2025", // password MQTT (disesuaikan dengan akun)
  clientId: "vercel_client_" + Math.random().toString(16).substr(2, 8), // clientId unik
  clean: true, // session clean saat disconnect
  reconnectPeriod: 1000, // mencoba reconnect setiap 1 detik jika terputus
  connectTimeout: 5000, // timeout koneksi 5 detik
};

// URL broker MQTT menggunakan WebSocket Secure
const brokerUrl =
  "wss://3107ee96d14c4007908cdd3e772e6600.s1.eu.hivemq.cloud:8884/mqtt";

// Membuat koneksi MQTT secara singleton (tidak membuat koneksi berulang)
const mqttClient = mqtt.connect(brokerUrl, mqttOptions);

// Event saat berhasil terkoneksi ke broker MQTT
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
});

// Event saat terjadi error pada koneksi MQTT
mqttClient.on("error", (err) => {
  console.error("MQTT connection error:", err);
});

// Event saat koneksi MQTT menjadi offline
mqttClient.on("offline", () => {
  console.error("MQTT client went offline");
});

// Event saat koneksi MQTT ditutup
mqttClient.on("close", () => {
  console.log("MQTT connection closed");
});

// Fungsi utama ekspor router dengan koneksi ke database
module.exports = function (db) {
  // Route GET utama (homepage)
  router.get("/", function (req, res, next) {
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      // Jika ada data user, simpan ke session dan render dashboard
      if (data.rows.length > 0) {
        req.session.user = data.rows[0];
        return res.render("dashboard/dashboard", { title: "Polines" });
      }

      // Jika tidak ada user, redirect ke halaman login
      return res.redirect("/");
    });
  });

  // Route GET untuk mengambil semua data user dan kirim ke MQTT
  router.get("/users", function (req, res, next) {
    db.query("SELECT * FROM users ORDER BY id_user ASC", (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      const usersData = result.rows;

      // Publish data user ke topik MQTT
      mqttClient.publish(
        "polines/TA2025",
        JSON.stringify(usersData),
        (mqttErr) => {
          if (mqttErr) {
            console.error("Publish error:", mqttErr);
          } else {
            console.log("Data sent to MQTT:", usersData);
          }
        }
      );

      // Kirim data sebagai respon API
      res.json(usersData);
    });
  });

  // Route POST untuk update data kontrol
  router.post("/", function (req, res, next) {
    // Ambil parameter dari body request
    const {
      mode = null,
      kp = null,
      ki = null,
      kd = null,
      set_point = null,
      set_point2 = null,
      time_sampling = null,
    } = req.body;

    console.log("Received values:", {
      mode,
      kp,
      ki,
      kd,
      set_point,
      set_point2,
      time_sampling,
    });

    // Pastikan session user tersedia
    const ensureUserSession = () =>
      new Promise((resolve, reject) => {
        if (req.session.user) {
          resolve(req.session.user);
        } else {
          // Ambil user pertama dari database dan set ke session
          db.query("SELECT * FROM users LIMIT 1", (err, data) => {
            if (err) reject(err);
            else if (data.rows.length > 0) {
              req.session.user = data.rows[0];
              resolve(req.session.user);
            } else {
              resolve(null);
            }
          });
        }
      });

    // Setelah memastikan session user
    ensureUserSession()
      .then((user) => {
        if (!user) {
          return res.redirect("/");
        }

        // Siapkan nilai-nilai untuk query update
        const values = [
          set_point === "" ? "0" : set_point,
          kp === "" ? "0" : kp,
          ki === "" ? "0" : ki,
          kd === "" ? "0" : kd,
          time_sampling || "0",
          mode,
          set_point2 === "" ? "0" : set_point2,
          user.id_user,
        ];

        // Validasi input (cek 5 parameter pertama)
        for (let i = 0; i < 7; i++) {
          if (values[i] === null || values[i] === "") {
            return res.status(400).send("Invalid input for parameter ${i + 1}");
          }
        }

        // Query untuk update data user
        const query = `
          UPDATE users
          SET setpoint = $1, kp = $2, ki = $3, kd = $4, time_sampling = $5, mode_kendali = $6, setpoint2 = $7
          WHERE id_user = $8
        `;

        db.query(query, values, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Database query error");
          }

          const dataToSend = {
            set_point: values[0],
            kp: values[1],
            ki: values[2],
            kd: values[3],
            time_sampling: values[4],
            mode: values[5],
            set_point2: values[6],
            user_id: values[7],
          };

          // Publish data hasil update ke topik MQTT
          mqttClient.publish(
            "polines/TA2025",
            JSON.stringify(dataToSend),
            (mqttErr) => {
              if (mqttErr) {
                console.error("Publish error:", mqttErr);
              } else {
                console.log("Data sent:", dataToSend);
              }
            }
          );

          // Kirim respon sukses
          res.status(200).send("Data updated successfully");
        });
      })
      .catch((err) => {
        console.error("Session or DB error:", err);
        res.status(500).send("Internal Server Error");
      });
  });

  // Kembalikan router untuk digunakan di app utama
  return router;
};
