const express = require("express");
const mqtt = require("mqtt");
const { Parser } = require("json2csv");
const mqttClient = require("./mqttClient"); // Impor modul MQTT

const router = express.Router();

let dbClient;

// Middleware autentikasi
function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

mqttClient.on("message", (topic, message) => {
  console.log(`MQTT ${topic}: ${message.toString()}`);

  if (topic.startsWith("RPM/output/")) {
    try {
      const data = JSON.parse(message.toString());
      const { RPM, nama_pengguna, t } = data;

      console.log(`RPM: ${RPM}, Name: ${nama_pengguna}, Time: ${t}`);

      if (dbClient) {
        const query = `INSERT INTO output (rpm, nama_pengguna, t) VALUES ($1, $2, $3)`;
        dbClient.query(query, [RPM, nama_pengguna, t], (err) => {
          if (err) console.error("DB insert error:", err);
          else console.log("RPM saved to DB");
        });
      } else {
        console.error("DB not initialized");
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }
  }
});

// Ekspor data ke CSV
router.get("/export", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id_user;

    const result = await dbClient.query(
      `
      SELECT 
        o.t,
        o.rpm,
        o.nama_pengguna,
        u.kp,
        u.ki,
        u.kd,
        u.setpoint AS set_point,
        u.setpoint2 AS set_point2,
        u.time_sampling AS time_sampling_user,
        u.mode_kendali
      FROM output o
      JOIN users u ON o.nama_pengguna = u.nama_pengguna
      WHERE u.id_user = $1
      ORDER BY o.t ASC
    `,
      [userId]
    );

    const fields = [
      "t",
      "rpm",
      "set_point",
      "set_point2",
      "kp",
      "ki",
      "kd",
      "time_sampling_user",
      "mode_kendali",
      "nama_pengguna",
    ];
    const csv = new Parser({ fields }).parse(result.rows);

    res.header("Content-Type", "text/csv");
    res.attachment("export_data.csv");
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).send("Export error");
  }
});

// Tambahkan endpoint ini
router.delete("/clear-data", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id_user;
    // Hapus data output milik user ini
    await dbClient.query("TRUNCATE TABLE public.output;");
    res.status(200).json({ message: "Data cleared" });
  } catch (err) {
    console.error("Clear data error:", err);
    res.status(500).json({ message: "Failed to clear data" });
  }
});

// Halaman dashboard
router.get("/", ensureAuthenticated, (req, res) => {
  res.render("dashboard/dashboard", {
    title: "Polines",
    user: req.session.user, // ✅ Tambahkan ini
  });
});

router.get("/users", ensureAuthenticated, async (req, res) => {
  try {
    const result = await dbClient.query(
      "SELECT * FROM users ORDER BY id_user ASC"
    );
    const usersData = result.rows;

    mqttClient.publish(
      "polines/TA2025",
      JSON.stringify(usersData),
      (mqttErr) => {
        if (mqttErr) console.error("MQTT publish error:", mqttErr);
        else console.log("Sent users via MQTT:", usersData);
      }
    );

    res.json(usersData);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send("Database error");
  }
});

// Input parameter kontrol dari form
router.post("/", ensureAuthenticated, (req, res) => {
  const {
    mode = null,
    kp = null,
    ki = null,
    kd = null,
    set_point = null,
    set_point2 = null,
    time_sampling = null,
  } = req.body;

  const user = req.session.user;
  const values = [
    set_point || "0",
    kp || "0",
    ki || "0",
    kd || "0",
    time_sampling || "0",
    mode,
    set_point2 || "0",
    user.id_user,
  ];

  // Validasi input
  for (let i = 0; i < 7; i++) {
    if (values[i] === null || values[i] === "") {
      return res.status(400).send(`Invalid input at parameter ${i + 1}`);
    }
  }

  const query = `
    UPDATE users
    SET setpoint = $1, kp = $2, ki = $3, kd = $4,
        time_sampling = $5, mode_kendali = $6, setpoint2 = $7
    WHERE id_user = $8
  `;

  dbClient.query(query, values, (err) => {
    if (err) {
      console.error("DB update error:", err);
      return res.status(500).send("Update failed");
    }

    const payload = {
      set_point: values[0],
      kp: values[1],
      ki: values[2],
      kd: values[3],
      time_sampling: values[4],
      mode: values[5],
      set_point2: values[6],
      user_id: values[7],
      nama_pengguna: user.nama_pengguna,
    };

    mqttClient.publish("polines/TA2025", JSON.stringify(payload), (mqttErr) => {
      if (mqttErr) console.error("MQTT send error:", mqttErr);
      else console.log("Data sent to MQTT:", payload);
    });

    res.status(200).send("Data updated successfully");
  });
});

module.exports = function (db) {
  dbClient = db;
  return router;
};
