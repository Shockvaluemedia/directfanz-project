'use client';

import { motion } from 'framer-motion';

interface Props {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
}

export function SetupProgressBar({ percentage, completedSteps, totalSteps }: Props) {
  return (
    <div className='mb-6'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm font-medium text-gray-700'>
          {completedSteps} of {totalSteps} steps complete
        </span>
        <span className='text-sm font-bold text-indigo-600'>{percentage}%</span>
      </div>

      <div className='h-3 bg-gray-200 rounded-full overflow-hidden'>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className='h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full relative overflow-hidden'
        >
          {/* Animated shimmer effect */}
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
            className='absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent'
          />
        </motion.div>
      </div>

      {/* Milestone messages */}
      {percentage === 100 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className='text-xs text-green-600 font-medium mt-2 text-center'
        >
          🎉 Setup complete! You're ready to start earning
        </motion.p>
      )}
      {percentage >= 80 && percentage < 100 && (
        <p className='text-xs text-indigo-600 font-medium mt-2 text-center'>
          Almost there! Just a few more steps
        </p>
      )}
      {percentage >= 50 && percentage < 80 && (
        <p className='text-xs text-gray-600 mt-2 text-center'>You're halfway there!</p>
      )}
    </div>
  );
}
