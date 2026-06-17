/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#FAF6EE',   // Elegant cream background
          100: '#F5EFE4',  // Cream hover
          150: '#EFE7DA',  // Soft border cream
          200: '#E4D8C5',  // Border cream
          300: '#D7C4A9',  // Accent cream
          400: '#BFA787',  // Muted caramel
          500: '#A38763',  // Soft truffle
          600: '#846645',  // Warm cocoa
          650: '#7C5E3D',  // Cocoa
          700: '#5C452E',  // Deep cocoa
          800: '#463321',  // Dark chocolate
          850: '#342417',  // Very dark chocolate
          900: '#23160E',  // Darkest truffle
          950: '#1b100a',  // Obsidian chocolate
        },
        violet: {
          50: '#FAF6EE',
          100: '#F6EBD9',
          200: '#ECCFA4',
          300: '#E0B072',
          400: '#D59449',
          500: '#C6762A', // Rich caramel
          600: '#A85F1C', // Deep caramel
          700: '#8C4B14',
          800: '#70380C',
          900: '#542605',
          950: '#3C1800',
        },
        indigo: {
          50: '#FAF6EE',
          100: '#F3E8D2',
          200: '#E7CFA5',
          300: '#D9B275',
          400: '#CA974C',
          500: '#BB7E2D', // Golden caramel
          600: '#9E651E',
          700: '#824E15',
          850: '#543007',
          950: '#2B1602',
        },
        teal: {
          50: '#FCF9F5',
          100: '#F6ECDF',
          200: '#EBD5BE',
          300: '#DDB997',
          400: '#CE9D72',
          500: '#C08353', // Caramel/Cacao
          600: '#A66B3D',
          700: '#8B552D',
          850: '#5F371A',
          950: '#351A08',
        },
        amber: {
          50: '#FEFCF9',
          100: '#FDF3E7',
          200: '#FBE2C5',
          300: '#F7CB97',
          400: '#F1AF6A',
          500: '#E79040', // Orange-caramel
          600: '#CB7629',
          700: '#A85A1A',
          800: '#854110',
          950: '#3C1800',
        },
        blue: {
          50: '#F9F6F0',
          100: '#F0E6D2',
          200: '#DFCDAB',
          300: '#CCA87B',
          400: '#B88550',
          500: '#A4652E', // Caramel
          600: '#895021',
          700: '#6F3D17',
          800: '#542C0F',
          950: '#2B1103',
        },
        emerald: {
          50: '#FAF6EE',
          100: '#F1E8D3',
          200: '#E3CFAB',
          300: '#D2B17F',
          400: '#C19557',
          500: '#AF7B35', // Truffle caramel
          600: '#916126',
          750: '#643F14',
          800: '#57360E',
          950: '#2C1902',
        }
      }
    }
  },
  plugins: [],
};
