export const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];

export const users = [
  { id: 'aalbahar',   name: 'Anuit Albahar',   email: 'aalbahar@cmcenters.org',   sections: ['providers'] },
  { id: 'fcarranza',  name: 'Flor Carranza',   email: 'fcarranza@cmcenters.org',  sections: ['careers'] },
  { id: 'kfield',     name: 'Kevin Field',      email: 'kfield@cmcenters.org',     sections: ['*'] },
  { id: 'molage',     name: 'Michelle Olage',   email: 'molage@cmcenters.org',     sections: ['locations', 'services', 'patients', 'providers'] },
  { id: 'sschindler', name: 'Scott Schindler',  email: 'sschindler@cmcenters.org', sections: ['*'] },
  { id: 'staft',      name: 'Sarah Taft',       email: 'staft@cmcenters.org',      sections: ['*'] },
  { id: 'tech',       name: 'IS Team',          email: 'tech@cmcenters.org',       sections: ['*'] },
];

// Read at call time (not module load) so dotenv has already run
export const getPasswordHash = (userId) =>
  process.env[`${userId.toUpperCase()}_PASSWORD_HASH`] || null;

export const getUserSections = (user) =>
  user.sections.includes('*') ? ALL_SECTIONS : user.sections;
