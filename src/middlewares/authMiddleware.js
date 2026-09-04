const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const encabezado = req.headers.authorization;
  const [tipo, token] = encabezado ? encabezado.split(' ') : [];

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token Bearer requerido' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function authorize(rolesPermitidos) {
  const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para este recurso' });
    }
    return next();
  };
}

const verificarRol = authorize;

module.exports = { verificarToken, authorize, verificarRol };
