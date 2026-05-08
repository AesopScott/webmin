export const ALL_SECTIONS = ['providers', 'locations', 'services', 'careers', 'patients', 'news'];

export const users = [
  {
    id: 'aalbahar',
    name: 'Anuit Albahar',
    email: 'aalbahar@cmcenters.org',
    passwordHash: process.env.AALBAHAR_PASSWORD_HASH,
    sections: ['providers'],
  },
  {
    id: 'fcarranza',
    name: 'Flor Carranza',
    email: 'fcarranza@cmcenters.org',
    passwordHash: process.env.FCARRANZA_PASSWORD_HASH,
    sections: ['careers'],
  },
  {
    id: 'kfield',
    name: 'Kevin Field',
    email: 'kfield@cmcenters.org',
    passwordHash: process.env.KFIELD_PASSWORD_HASH,
    sections: ['*'],
  },
  {
    id: 'molage',
    name: 'Michelle Olage',
    email: 'molage@cmcenters.org',
    passwordHash: process.env.MOLAGE_PASSWORD_HASH,
    sections: ['locations', 'services', 'patients', 'providers'],
  },
  {
    id: 'sschindler',
    name: 'Scott Schindler',
    email: 'sschindler@cmcenters.org',
    passwordHash: process.env.SSCHINDLER_PASSWORD_HASH,
    sections: ['*'],
  },
  {
    id: 'staft',
    name: 'Sarah Taft',
    email: 'staft@cmcenters.org',
    passwordHash: process.env.STAFT_PASSWORD_HASH,
    sections: ['*'],
  },
  {
    id: 'tech',
    name: 'IS Team',
    email: 'tech@cmcenters.org',
    passwordHash: process.env.TECH_PASSWORD_HASH,
    sections: ['*'],
  },
];

export const getUserSections = (user) =>
  user.sections.includes('*') ? ALL_SECTIONS : user.sections;
