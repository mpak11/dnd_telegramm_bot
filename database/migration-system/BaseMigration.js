class BaseMigration {
  constructor(version, name) {
    this.version = version;
    this.name = name;
  }

  async up(db) {
    throw new Error('Метод up() должен быть реализован в наследнике');
  }
}

module.exports = BaseMigration;