require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

const PASSWORD = 'admin123';
const EMAILS = ['admin@sacware.local', 'produccion@sacware.local'];

async function resetUsuarios() {
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (const email of EMAILS) {
      const [resultado] = await pool.query(
        'UPDATE usuarios SET password_hash = ? WHERE email = ?',
        [passwordHash, email]
      );
      if (resultado.affectedRows !== 1) {
        throw new Error(`No se actualizo el usuario ${email}`);
      }

      const [filas] = await pool.query(
        'SELECT password_hash FROM usuarios WHERE email = ?',
        [email]
      );
      const passwordValida = await bcrypt.compare(PASSWORD, filas[0].password_hash);
      console.log(`${email}: ${resultado.affectedRows} fila actualizada; contraseña verificada: ${passwordValida}`);
    }
  } finally {
    await pool.end();
  }
}

resetUsuarios().catch((error) => {
  console.error('No se pudieron resetear los usuarios:', error.message);
  process.exitCode = 1;
});
