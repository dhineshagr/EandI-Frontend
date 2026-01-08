import React from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";

const NotFoundPage = () => {
  return (
    <>
      {/* Header will render only if session exists */}
      <Header />

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl text-red-700 font-bold mb-4">
          404 - Page Not Found
        </h1>

        <p className="text-lg text-gray-700 mb-6">
          Oops! That page doesn't exist or may have been moved.
        </p>

        <Link
          to="/upload"
          className="bg-[#0F1F4B] hover:bg-[#1e2f60] text-white px-6 py-2 rounded-lg shadow transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </>
  );
};

export default NotFoundPage;
