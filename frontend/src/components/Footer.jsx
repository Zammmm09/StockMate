const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>📦</span> StockMate
            </h3>
            <p className="text-blue-100">
              A modern inventory management system for managing warehouses and products efficiently.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-blue-100 hover:text-white transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/inventory" className="text-blue-100 hover:text-white transition-colors">
                  Inventory
                </a>
              </li>
              <li>
                <a href="/warehouses" className="text-blue-100 hover:text-white transition-colors">
                  Warehouses
                </a>
              </li>
            </ul>
          </div>

          {/* About Me Section */}
          <div>
            <h3 className="text-xl font-bold mb-4">About</h3>
            <p className="text-blue-100 mb-2">
              Created with ❤️ by
            </p>
            <p className="text-white font-semibold text-lg">
              Zaeem
            </p>
            <p className="text-blue-100 text-sm mt-2">
              A college project for inventory management
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-blue-500 mt-8 pt-6 text-center">
          <p className="text-blue-100">
            © {new Date().getFullYear()} StockMate. All rights reserved.
          </p>
          <p className="text-blue-200 text-sm mt-2">
            Built with React, Node.js, and MongoDB
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

