import React from 'react';
import type { Applicant } from '../types';
import { Clock, User, FileText, AlertTriangle } from 'lucide-react';

interface ApplicantCardProps {
  applicant: Applicant;
}

const ApplicantCard: React.FC<ApplicantCardProps> = ({ applicant }) => {
  // Calculate days in current stage
  const daysInStage = Math.floor(
    (Date.now() - applicant.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine card color based on priority and time in stage
  const getCardBorderColor = () => {
    if (daysInStage > 21) return 'border-l-red-500'; // Overdue
    if (daysInStage > 14) return 'border-l-yellow-500'; // Warning
    return 'border-l-green-500'; // On track
  };

  // Count completed documents
  const completedDocs = applicant.documents.filter(doc => doc.completed).length;
  const totalDocs = applicant.documents.length;

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 mb-3 border-l-4 ${getCardBorderColor()} hover:shadow-lg transition-shadow cursor-pointer`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">{applicant.name}</h3>
        {applicant.priority === 'high' && (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        )}
      </div>

      {/* Unit info if available */}
      {applicant.unit && (
        <p className="text-sm text-gray-600 mb-2">{applicant.unit}</p>
      )}

      {/* Time in stage */}
      <div className="flex items-center text-sm text-gray-600 mb-2">
        <Clock className="w-4 h-4 mr-1" />
        <span>Day {daysInStage} in stage</span>
      </div>

      {/* Case manager */}
      {applicant.caseManager && (
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <User className="w-4 h-4 mr-1" />
          <span>CM: {applicant.caseManager}</span>
        </div>
      )}

      {/* Document status */}
      {totalDocs > 0 && (
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <FileText className="w-4 h-4 mr-1" />
          <span>Docs: {completedDocs}/{totalDocs} complete</span>
        </div>
      )}

      {/* Document checklist */}
      {applicant.documents.length > 0 && (
        <div className="mb-2">
          {applicant.documents.map((doc, index) => (
            <div key={index} className="flex items-center text-xs text-gray-600">
              <span className={`mr-2 ${doc.completed ? 'text-green-600' : 'text-red-600'}`}>
                {doc.completed ? '✅' : '❌'}
              </span>
              <span className={doc.required ? 'font-medium' : 'text-gray-500'}>
                {doc.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {applicant.notes && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
          {applicant.notes}
        </div>
      )}

      {/* Status indicator */}
      <div className="mt-2 text-xs">
        {daysInStage > 21 && (
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
            OVERDUE
          </span>
        )}
        {daysInStage > 14 && daysInStage <= 21 && (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
            APPROACHING DEADLINE
          </span>
        )}
        {daysInStage <= 14 && (
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
            ON TRACK
          </span>
        )}
      </div>
    </div>
  );
};

export default ApplicantCard;