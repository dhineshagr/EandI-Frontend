import React from "react";
import { Link } from "react-router-dom";

const UnauthorizedPage = () => (
  <div className="unauthorized-page min-h-screen bg-gray-100 flex flex-col items-center justify-center text-center p-6">
    <h1 className="text-4xl text-red-600 font-bold mb-4">🚫 Unauthorized</h1>
    <p className="text-lg text-gray-700 mb-6">
      You do not have access to this page.
    </p>

    <Link
      to="/"
      className="bg-[#0F1F4B] text-white px-6 py-2 rounded hover:bg-[#1E2F60] transition"
    >
      Return to Dashboard
    </Link>
  </div>
);

export default UnauthorizedPage;
