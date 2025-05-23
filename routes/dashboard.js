// Mengimpor modul Express dan MQTT
var express = require("express");
var mqtt = require("mqtt");
var router = express.Router();

// Mengekspor fungsi yang menerima parameter koneksi database (db)
module.exports = function (db) {
  // Rute GET "/"
  router.get("/", function (req, res, next) {
    db.query("SELECT * FROM users", (err, data) => {
      if (err) {
        console.log(err);
        return res.send(err);
      }

      if (data.rows.length > 0) {
        req.session.user = data.rows[0];
        return res.render("dashboard/dashboard", { title: "Polines" });
      }

      return res.redirect("/");
    });
  });

  // Rute GET "/users"
  router.get("/users", function (req, res, next) {
    db.query("SELECT * FROM users ORDER BY id_user ASC", (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Database query error");
      }

      const usersData = result.rows; // Ambil semua data pengguna

      // Koneksi ke broker MQTT
      const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

      mqttClient.on("connect", () => {
        console.log("Connected to MQTT broker");

        // Kirim data pengguna ke topik MQTT
        mqttClient.publish(
          "your/topicTA",
          JSON.stringify(usersData),
          (mqttErr) => {
            if (mqttErr) {
              console.error("Publish error:", mqttErr);
            } else {
              console.log("Data sent to MQTT:", usersData);
            }
            mqttClient.end(); // Tutup koneksi MQTT
          }
        );
      });

      // Kirim data pengguna sebagai JSON ke klien HTTP
      res.json(usersData); // Mengirim semua data pengguna sebagai JSON
    });
  });

  // Rute GET "/datamasuk"
  router.get("/datamasuk", function (req, res, next) {
    db.query(
      "SELECT * FROM your_table_name ORDER BY created_at DESC",
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).send("Database query error");
        }

        res.json(result.rows); // Kirim data sebagai JSON
      }
    );
  });

  // Rute POST "/"
  router.post("/", function (req, res, next) {
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

    const values = [
      set_point || "0",
      kp === "" ? "0" : kp,
      ki === "" ? "0" : ki,
      kd === "" ? "0" : kd,
      time_sampling || "0",
      mode,
      set_point2 === "" ? "0" : set_point2,
      req.session.user ? req.session.user.id_user : null,
    ];

    for (let i = 0; i < 5; i++) {
      if (values[i] === null || values[i] === "") {
        return res.status(400).send(`Invalid input for parameter ${i + 1}`);
      }
    }

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

      const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

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

      mqttClient.on("connect", () => {
        console.log("Connected to MQTT broker");

        mqttClient.publish(
          "polines/TA2025",
          JSON.stringify(dataToSend),
          (mqttErr) => {
            if (mqttErr) {
              console.error("Publish error:", mqttErr);
            } else {
              console.log("Data sent:", dataToSend);
            }
            mqttClient.end(); // Tutup koneksi MQTT
          }
        );
      });

      res.status(200).send("Data updated successfully");
    });
  });

  return router;
};
