# Insurance Underwriting Demo Application

A demo application that mimics Salesforce org functionality for insurance underwriters. Built with Next.js, React, and Salesforce Lightning Design System (SLDS).

## Features

- **Insurance Submission Object**: Complete record page with details, documents, and activity timeline
- **Salesforce-like UI**: Uses native SLDS components for authentic look and feel
- **Record Pages**: List view and detail view for Insurance Submissions
- **Related Lists**: Documents and Activity Timeline
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Framework**: Next.js 14.2
- **UI Library**: Salesforce Design System React Components
- **Styling**: Salesforce Lightning Design System (SLDS)
- **Language**: TypeScript
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── components/
│   ├── Navigation/          # Global header and navigation
│   ├── RecordPage/          # Record page components (header, details)
│   └── RelatedLists/        # Related list components (documents, activity)
├── data/
│   └── mockSubmissions.ts   # Mock data for submissions
├── pages/
│   ├── index.tsx           # List view of submissions
│   └── submissions/[id].tsx # Detail view of a submission
├── styles/
│   └── globals.css         # Global styles with SLDS imports
└── types/
    └── InsuranceSubmission.ts # TypeScript interfaces
```

## Insurance Submission Object

The Insurance Submission object includes the following fields:

- **Basic Info**: Name, Status, Policy Type, Insured Name & Address
- **Dates**: Submission Date, Effective Date, Expiration Date
- **Financial**: Total Premium, Coverage Amount
- **People**: Underwriter, Broker
- **Risk**: Risk Score
- **Notes**: Detailed notes about the submission

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Customization

### Adding New Fields

1. Update the `InsuranceSubmission` interface in `src/types/InsuranceSubmission.ts`
2. Add mock data in `src/data/mockSubmissions.ts`
3. Update the UI in `src/components/RecordPage/DetailsSection.tsx`

### Adding New Related Lists

1. Create a new component in `src/components/RelatedLists/`
2. Import and add it to the record detail page in `src/pages/submissions/[id].tsx`

### Styling

All SLDS components and utilities are available. Refer to the [SLDS Component Library](https://react.lightningdesignsystem.com/) for component documentation.

## Next Steps

- Add form functionality for creating/editing submissions
- Implement real API integration
- Add authentication
- Create additional custom LWC-like components
- Add list view filters and sorting
- Implement approval workflows

## Resources

- [Salesforce Lightning Design System](https://www.lightningdesignsystem.com/)
- [SLDS React Components](https://react.lightningdesignsystem.com/)
- [Next.js Documentation](https://nextjs.org/docs)
