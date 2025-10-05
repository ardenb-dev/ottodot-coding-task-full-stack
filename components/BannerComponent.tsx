interface BannerComponentPropTypes {
  message: string;
}

export const BannerComponent = ({ message }: BannerComponentPropTypes) => {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className={`flex gap-4 px-4 py-3 bg-[#e84c3d]`}>
        <svg
          className="h-6 w-6 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 2a1 1 0 00-.993.883L9 9v4a1 1 0 001.993.117L11 13V9a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-[#fffafa] font-medium">{message}</p>
      </div>
    </div>
  );
};
