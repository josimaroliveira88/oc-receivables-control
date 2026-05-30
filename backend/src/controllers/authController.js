// Placeholder for authentication controller
// Will implement login logic here

const login = (req, res) => {
  // TODO: Implement login logic with bcrypt and JWT
  // For now, return a mock response for development
  res.status(200).json({ 
    token: 'mock-token-for-development', 
    expiresIn: '24h' 
  });
};

module.exports = {
  login
};