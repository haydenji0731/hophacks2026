import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import Results from "./pages/Results.jsx";
import Repository from "./pages/Repository.jsx";
import ScamDetail from "./pages/ScamDetail.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="results" element={<Results />} />
        <Route path="scams" element={<Repository />} />
        <Route path="scams/:id" element={<ScamDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
